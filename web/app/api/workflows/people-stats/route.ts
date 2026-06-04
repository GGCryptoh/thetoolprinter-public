import { start } from 'workflow/api';
import { requireCronAuth } from '@/lib/api/cron-auth';
import { peopleStatsWorkflow } from '@/lib/workflow/people-stats';

export async function POST(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const run = await start(peopleStatsWorkflow);

  return Response.json({
    ok: true,
    runId: run.runId,
    message: 'People stats workflow started',
  });
}

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  console.log('[people-stats] Manual workflow trigger via GET');
  const run = await start(peopleStatsWorkflow);

  return Response.json({
    ok: true,
    runId: run.runId,
    message: 'People stats workflow started (manual trigger)',
  });
}
