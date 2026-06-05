import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const DISPLAY_TOTAL = 1000;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const isAdmin = searchParams.get('admin_key') === process.env.ADMIN_PASSWORD;

    // ใช้ SCARD นับโค้ดใน pool (real-time ถูกต้อง 100%)
    const poolRemaining = await redis.scard('code_pool');
    const poolTotal = await redis.get('code_pool_total');
    const realTotal = poolTotal ? parseInt(poolTotal) : 0;
    const realUsed = realTotal - poolRemaining;

    const displayUsed = realUsed * 2;

    if (!isAdmin) {
      return Response.json({
        total: DISPLAY_TOTAL,
        used: displayUsed,
        remaining: DISPLAY_TOTAL - displayUsed,
        realUsed,
        realTotal,
      });
    }

    const logCount = await redis.llen('draw_log');
    const logs = logCount > 0 ? await redis.lrange('draw_log', 0, 29) : [];
    const parsedLogs = logs.map(l => {
      try { return typeof l === 'string' ? JSON.parse(l) : l; } catch { return null; }
    }).filter(Boolean);

    return Response.json({
      total: DISPLAY_TOTAL,
      used: displayUsed,
      remaining: DISPLAY_TOTAL - displayUsed,
      realUsed,
      realTotal,
      logs: parsedLogs,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
