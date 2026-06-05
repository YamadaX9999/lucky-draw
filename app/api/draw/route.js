import { Redis } from '@upstash/redis';
import { CODES } from '../../../lib/codes';

const redis = Redis.fromEnv();

export async function POST(req) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const existing = await redis.get(`ip:${ip}`);
    if (existing !== null && existing !== undefined) {
      return Response.json({ status: 'already_drawn', code: existing || null });
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

    await redis.set(`ip:${ip}`, code);
    await redis.lpush('used_codes', code);

    return Response.json({ status: 'won', code });
  } catch (err) {
    console.error(err);
    return Response.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
