import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const DISPLAY_TOTAL = 1000;

function getAdminKey(req) {
  return req.headers.get('x-admin-key') || '';
}

export async function GET(req) {
  try {
    const isAdmin = getAdminKey(req) === process.env.ADMIN_PASSWORD;

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

    // ดึง log ทั้งหมด (cap ไว้ที่ 1000 รายการ)
    const logCount = await redis.llen('draw_log');
    const logs = logCount > 0 ? await redis.lrange('draw_log', 0, 999) : [];
    const parsedLogs = logs.map(l => {
      try { return typeof l === 'string' ? JSON.parse(l) : l; } catch { return null; }
    }).filter(Boolean);

    // ltrim: เก็บไว้แค่ 1000 รายการล่าสุด ป้องกัน list โตไม่หยุด
    if (logCount > 1000) {
      await redis.ltrim('draw_log', 0, 999);
    }

    return Response.json({
      total: DISPLAY_TOTAL,
      used: displayUsed,
      remaining: DISPLAY_TOTAL - displayUsed,
      realUsed,
      realTotal,
      logCount: parsedLogs.length,
      logs: parsedLogs,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
