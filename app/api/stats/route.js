import { kv } from '@vercel/kv';
import { CODES } from '../../../lib/codes';

export async function GET() {
  try {
    const usedCount = await kv.llen('used_codes');
    const usedCodes = usedCount > 0 ? await kv.lrange('used_codes', 0, -1) : [];

    const ipKeys = await kv.keys('ip:*');
    const ipList = [];
    for (const key of ipKeys.slice(-30)) {
      const code = await kv.get(key);
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
