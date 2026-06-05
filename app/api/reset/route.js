import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function POST(req) {
  try {
    const { password } = await req.json();
    if (password !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [lineKeys, rlKeys, phoneKeys, ipKeys] = await Promise.all([
      redis.keys('line:*'),
      redis.keys('rl:*'),
      redis.keys('phone:*'),
      redis.keys('ip:*'),
    ]);

    const allKeys = [...lineKeys, ...rlKeys, ...phoneKeys, ...ipKeys, 'used_codes', 'draw_log'];
    for (const key of allKeys) {
      await redis.del(key);
    }

    return Response.json({ status: 'ok' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
