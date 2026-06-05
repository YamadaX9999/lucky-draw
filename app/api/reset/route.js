import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { CODES } from '../../../lib/codes';

const redis = Redis.fromEnv();

// Rate limit สำหรับ reset: 5 ครั้ง / 15 นาที ป้องกัน brute force
const resetRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, '15 m'),
  prefix: 'rl:reset',
});

export async function POST(req) {
  try {
    // Rate limit ต่อ IP ก่อนเช็ครหัสผ่าน
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { success } = await resetRatelimit.limit(ip);
    if (!success) {
      return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const { password } = await req.json();
    if (password !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ลบ keys ด้วย SCAN แทน KEYS เพื่อไม่บล็อก Redis
    const keyPatterns = ['line:*', 'rl:*', 'rl:uid:*', 'rl:ip:*', 'rl:reset:*', '@upstash/ratelimit:*'];
    for (const pattern of keyPatterns) {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
        cursor = parseInt(nextCursor);
        if (keys.length > 0) {
          await Promise.all(keys.map(k => redis.del(k)));
        }
      } while (cursor !== 0);
    }

    // ลบ keys คงที่
    await Promise.all([
      redis.del('draw_log'),
      redis.del('code_pool'),
      redis.del('code_pool_total'),
    ]);

    // โหลด code pool ใหม่จาก CODES
    if (CODES.length > 0) {
      await redis.sadd('code_pool', ...CODES);
      await redis.set('code_pool_total', CODES.length);
    }

    return Response.json({ status: 'ok' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
