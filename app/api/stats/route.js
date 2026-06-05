import { Redis } from '@upstash/redis';
import { CODES } from '../../../lib/codes';

const redis = Redis.fromEnv();

const DISPLAY_TOTAL = 1000;

export async function GET(req) {
  try {
    // ตรวจสอบ admin key สำหรับ logs (ข้อมูล sensitive)
    // stats ทั่วไป (used/total) ยังเปิดให้ดูได้
    const { searchParams } = new URL(req.url);
    const isAdmin = searchParams.get('admin_key') === process.env.ADMIN_PASSWORD;

    const usedCount = await redis.llen('used_codes');
    const displayUsed = usedCount * 2;

    // ถ้าไม่ใช่ admin ส่งแค่ตัวเลข ไม่ส่ง logs
    if (!isAdmin) {
      return Response.json({
        total: DISPLAY_TOTAL,
        used: displayUsed,
        remaining: DISPLAY_TOTAL - displayUsed,
        realUsed: usedCount,
        realTotal: CODES.length,
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
      realUsed: usedCount,
      realTotal: CODES.length,
      logs: parsedLogs,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
