import { requireCronAuth } from '@/lib/api/cron-auth';
import { archiveStaleRejected } from '@/lib/retention';

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  try {
    const result = await archiveStaleRejected();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
