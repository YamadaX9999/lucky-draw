import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { CODES } from '../../../lib/codes';

const redis = Redis.fromEnv();

// Rate limit ต่อ UID (1 ครั้ง / 24 ชม.)
const uidRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(1, '24 h'),
  prefix: 'rl:uid',
});

// Rate limit ต่อ IP (3 ครั้ง / 24 ชม.)
const ipRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(3, '24 h'),
  prefix: 'rl:ip',
});

// ดึง profile + verify token ในครั้งเดียว
async function getVerifiedProfile(accessToken) {
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) return null;
  const profile = await profileRes.json();
  if (!profile.userId) return null;

  // verify ว่า token ออกจาก channel ของเรา
  const verifyRes = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`);
  if (!verifyRes.ok) return null;
  const tokenInfo = await verifyRes.json();
  if (tokenInfo.client_id !== process.env.LINE_CHANNEL_ID) return null;
  if (tokenInfo.expires_in <= 0) return null;

  return profile;
}

export async function POST(req) {
  try {
    const { accessToken } = await req.json();

    if (!accessToken || typeof accessToken !== 'string') {
      return Response.json({ status: 'unauthorized' }, { status: 401 });
    }

    // verify token + ดึง profile
    const profile = await getVerifiedProfile(accessToken);
    if (!profile) {
      return Response.json({ status: 'unauthorized' }, { status: 401 });
    }

    const uid = profile.userId;

    // เช็ค already_drawn ก่อน rate limit เลย
    // เพื่อให้คนที่สุ่มไปแล้วดูโค้ดตัวเองได้โดยไม่กระทบ rate limit
    const existingCode = await redis.get(`line:${uid}`);
    if (existingCode !== null && existingCode !== undefined) {
      return Response.json({ status: 'already_drawn', code: existingCode });
    }

    // Rate limit ต่อ IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipResult = await ipRatelimit.limit(ip);
    if (!ipResult.success) {
      const retryAfterHrs = Math.ceil((ipResult.reset - Date.now()) / 1000 / 60 / 60);
      return Response.json({ status: 'rate_limited', retryAfter: retryAfterHrs });
    }

    // Rate limit ต่อ UID
    const uidResult = await uidRatelimit.limit(uid);
    if (!uidResult.success) {
      const retryAfterHrs = Math.ceil((uidResult.reset - Date.now()) / 1000 / 60 / 60);
      return Response.json({ status: 'rate_limited', retryAfter: retryAfterHrs });
    }

    // ดึงโค้ดที่ใช้ไปแล้ว
    const usedCount = await redis.llen('used_codes');
    if (usedCount >= CODES.length) {
      return Response.json({ status: 'empty' });
    }

    const allUsed = usedCount > 0 ? await redis.lrange('used_codes', 0, -1) : [];
    const usedSet = new Set(allUsed);
    const remaining = CODES.filter(c => !usedSet.has(c));

    if (remaining.length === 0) {
      return Response.json({ status: 'empty' });
    }

    // เลือกโค้ดแบบ atomic ด้วย Redis transaction
    // ป้องกัน race condition กรณีหลายคนกดพร้อมกัน
    const code = remaining[Math.floor(Math.random() * remaining.length)];

    // ใช้ pipeline เพื่อ atomic write
    // SET NX = set only if not exists ป้องกันโค้ดซ้ำ
    const setResult = await redis.set(`line:${uid}`, code, { nx: true });
    if (!setResult) {
      // มีคนอื่น set ก่อนแล้ว (race condition) ดึงโค้ดที่บันทึกไว้
      const savedCode = await redis.get(`line:${uid}`);
      return Response.json({ status: 'already_drawn', code: savedCode });
    }

    await redis.lpush('used_codes', code);
    await redis.lpush('draw_log', JSON.stringify({ uid, code, time: Date.now() }));

    return Response.json({ status: 'won', code });
  } catch (err) {
    console.error(err);
    return Response.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
