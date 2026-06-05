import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redis = Redis.fromEnv();

const exportRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10, '15 m'),
  prefix: 'rl:export',
});

export async function GET(req) {
  try {
    const adminKey = req.headers.get('x-admin-key') || '';
    if (adminKey !== process.env.ADMIN_PASSWORD) {
      return new Response('Unauthorized', { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { success } = await exportRatelimit.limit(ip);
    if (!success) {
      return new Response('Too many requests', { status: 429 });
    }

    // ดึง log ทั้งหมดจาก Redis
    const logCount = await redis.llen('draw_log');
    const logs = logCount > 0 ? await redis.lrange('draw_log', 0, -1) : [];
    const parsedLogs = logs.map(l => {
      try { return typeof l === 'string' ? JSON.parse(l) : l; } catch { return null; }
    }).filter(Boolean);

    // สร้าง CSV
    const header = 'LINE UID,Code,Date,Time';
    const rows = parsedLogs.map(item => {
      const d = new Date(item.time);
      const date = d.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `${item.uid},${item.code},${date},${time}`;
    });

    const csv = '\uFEFF' + [header, ...rows].join('\r\n'); // BOM สำหรับ Excel ภาษาไทย
    const filename = `lucky-draw-export-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
