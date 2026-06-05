import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

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

async function getVerifiedProfile(accessToken) {
  const [profileRes, verifyRes] = await Promise.all([
    fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`),
  ]);

  if (!profileRes.ok || !verifyRes.ok) return null;

  const [profile, tokenInfo] = await Promise.all([profileRes.json(), verifyRes.json()]);

  if (!profile.userId) return null;
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

    const profile = await getVerifiedProfile(accessToken);
    if (!profile) {
      return Response.json({ status: 'unauthorized' }, { status: 401 });
    }

    const uid = profile.userId;

    // เช็ค already_drawn ก่อน rate limit เพื่อไม่กินโควต้า
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

    // SPOP: สุ่มเลือกและลบออกจาก pool ในคำสั่งเดียว → atomic 100% ไม่มี race condition
    const code = await redis.spop('code_pool');
    if (!code) {
      return Response.json({ status: 'empty' });
    }

    // บันทึก UID → code และ log
    await redis.set(`line:${uid}`, code);
    await redis.lpush('draw_log', JSON.stringify({ uid, code, time: Date.now() }));

    return Response.json({ status: 'won', code });
  } catch (err) {
    console.error(err);
    return Response.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
