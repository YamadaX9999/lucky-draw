import { Redis } from '@upstash/redis';
import { CODES } from '../../../lib/codes';

const redis = Redis.fromEnv();

export async function GET() {
  try {
    const usedCount = await redis.llen('used_codes');
    const usedCodes = usedCount > 0 ? await redis.lrange('used_codes', 0, -1) : [];

    const ipKeys = await redis.keys('ip:*');
    const ipList = [];
    for (const key of ipKeys.slice(-30)) {
      const code = await redis.get(key);
      ipList.push({ ip: key.replace('ip:', ''), code });
    }

    return Response.json({
      total: CODES.length,
      used: usedCount,
      remaining: CODES.length - usedCount,
      usedCodes,
      ipList,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
