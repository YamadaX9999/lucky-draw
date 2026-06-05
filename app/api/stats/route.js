import { Redis } from '@upstash/redis';
import { CODES } from '../../../lib/codes';

const redis = Redis.fromEnv();

export async function GET() {
  try {
    const usedCount = await redis.llen('used_codes');
    const logCount = await redis.llen('draw_log');
    const logs = logCount > 0 ? await redis.lrange('draw_log', 0, 29) : [];

    const parsedLogs = logs.map(l => {
      try { return typeof l === 'string' ? JSON.parse(l) : l; } catch { return null; }
    }).filter(Boolean);

    return Response.json({
      total: CODES.length,
      used: usedCount,
      remaining: CODES.length - usedCount,
      logs: parsedLogs,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
