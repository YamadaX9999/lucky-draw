import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function POST(req) {
  try {
    const { password } = await req.json();
    if (password !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ipKeys = await redis.keys('ip:*');
    for (const key of ipKeys) {
      await redis.del(key);
    }
    await redis.del('used_codes');

    return Response.json({ status: 'ok', message: 'Reset complete' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
