import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { CODES } from '../../../lib/codes';

const redis = Redis.fromEnv();

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(1, '24 h'),
  prefix: 'rl',
});

export async function POST(req) {
  try {
    const { uid } = await req.json();

    if (!uid || typeof uid !== 'string' || !uid.startsWith('U')) {
      return Response.json({ status: 'unauthorized' });
    }

    // Rate limit ต่อ Line UID
    const { success, reset } = await ratelimit.limit(uid);
    if (!success) {
      const retryAfterHrs = Math.ceil((reset - Date.now()) / 1000 / 60 / 60);
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
