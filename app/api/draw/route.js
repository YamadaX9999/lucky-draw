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

// Rate limit ต่อ IP (3 ครั้ง / 24 ชม. กันคนมีหลาย LINE account)
const ipRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(3, '24 h'),
  prefix: 'rl:ip',
});

async function verifyLiffToken(accessToken) {
  const res = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`);
  if (!res.ok) return null;
  const data = await res.json();
  // ตรวจสอบว่า token ออกจาก channel ของเราจริง
  if (data.client_id !== process.env.LINE_CHANNEL_ID) return null;
  if (data.expires_in <= 0) return null;
  return data;
}

async function getLineProfile(accessToken) {
  const res = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function POST(req) {
  try {
    const { accessToken } = await req.json();

    if (!accessToken || typeof accessToken !== 'string') {
      return Response.json({ status: 'unauthorized' }, { status: 401 });
    }

    // ยืนยัน token กับ LINE server
    const tokenInfo = await verifyLiffToken(accessToken);
    if (!tokenInfo) {
      return Response.json({ status: 'unauthorized' }, { status: 401 });
    }

    // ดึง profile จาก LINE
    const profile = await getLineProfile(accessToken);
    if (!profile || !profile.userId) {
      return Response.json({ status: 'unauthorized' }, { status: 401 });
    }

    const uid = profile.userId;

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

    // เช็คว่า UID นี้เคยสุ่มแล้วหรือยัง
    const byUid = await redis.get(`line:${uid}`);
    if (byUid !== null && byUid !== undefined) {
      return Response.json({ status: 'already_drawn', code: byUid });
    }

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

    const code = remaining[Math.floor(Math.random() * remaining.length)];

    await redis.set(`line:${uid}`, code);
    await redis.lpush('used_codes', code);
    await redis.lpush('draw_log', JSON.stringify({ uid, code, time: Date.now() }));

    return Response.json({ status: 'won', code });
  } catch (err) {
    console.error(err);
    return Response.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
