import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { CODES } from '../../../lib/codes';

const redis = Redis.fromEnv();

// 1 ครั้ง ต่อ 24 ชั่วโมง ต่อ IP
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(1, '24 h'),
  prefix: 'rl',
});

export async function POST(req) {
  try {
    const { phone } = await req.json();

    if (!phone || !/^0[0-9]{8,9}$/.test(phone.replace(/[-\s]/g, ''))) {
      return Response.json({ status: 'invalid_phone' });
    }

    const cleanPhone = phone.replace(/[-\s]/g, '');

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // เช็ค rate limit ก่อนเลย
    const { success, reset } = await ratelimit.limit(ip);
    if (!success) {
      const retryAfterMs = reset - Date.now();
      const retryAfterHrs = Math.ceil(retryAfterMs / 1000 / 60 / 60);
      return Response.json({
        status: 'rate_limited',
        retryAfter: retryAfterHrs,
      });
    }

    // เช็คเบอร์ซ้ำ
    const byPhone = await redis.get(`phone:${cleanPhone}`);
    if (byPhone !== null && byPhone !== undefined) {
      return Response.json({ status: 'already_drawn', code: byPhone || null, by: 'phone' });
    }

    // เช็ค IP ซ้ำ (legacy check)
    const byIp = await redis.get(`ip:${ip}`);
    if (byIp !== null && byIp !== undefined) {
      return Response.json({ status: 'already_drawn', code: byIp || null, by: 'ip' });
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

    await redis.set(`phone:${cleanPhone}`, code);
    await redis.set(`ip:${ip}`, code);
    await redis.lpush('used_codes', code);
    await redis.lpush('draw_log', JSON.stringify({ phone: cleanPhone, ip, code, time: Date.now() }));

    return Response.json({ status: 'won', code });
  } catch (err) {
    console.error(err);
    return Response.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
