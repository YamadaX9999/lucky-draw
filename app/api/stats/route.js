import { Redis } from '@upstash/redis';
import { CODES } from '../../../lib/codes';

const redis = Redis.fromEnv();

const DISPLAY_TOTAL = 1000;

export async function GET() {
  try {
    const usedCount = await redis.llen('used_codes');
    const logCount = await redis.llen('draw_log');
    const logs = logCount > 0 ? await redis.lrange('draw_log', 0, 29) : [];

    const parsedLogs = logs.map(l => {
      try { return typeof l === 'string' ? JSON.parse(l) : l; } catch { return null; }
    }).filter(Boolean);

    // usedCount = จำนวนโค้ดจริงที่แจกไป, แต่แสดงผลเป็น x2
    const displayUsed = usedCount * 2;

    return Response.json({
      total: DISPLAY_TOTAL,
      used: displayUsed,
      remaining: DISPLAY_TOTAL - displayUsed,
      realUsed: usedCount,
      realTotal: CODES.length,
      logs: parsedLogs,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
