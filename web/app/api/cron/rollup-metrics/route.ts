import { requireCronAuth } from '@/lib/api/cron-auth';
import { rollupDailyMetrics, pruneIngestEventsByAge } from '@/lib/workflow/metrics-rollup';
import { getLogRetentionDays } from '@/lib/setup/state';

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  try {
    // 1. Roll the last few days into durable daily_metrics (idempotent).
    const rolledDays = await rollupDailyMetrics(3);

    // 2. Now that aggregates are safe, auto-prune raw logs past the retention
    //    window (0 = keep everything).
    const retentionDays = await getLogRetentionDays();
    const prunedLogs = retentionDays > 0 ? await pruneIngestEventsByAge(retentionDays) : 0;

    return Response.json({ ok: true, rolledDays, retentionDays, prunedLogs });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
