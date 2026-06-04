import { start } from 'workflow/api';
import { requireCronAuth } from '@/lib/api/cron-auth';
import { getFrontPageController } from '@/lib/front-page/controller';
import { ingestWorkflow } from '@/lib/workflow/ingest';
import { shouldStartScheduledIngest } from '@/lib/workflow/schedule';

export async function POST(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const controlRunId = crypto.randomUUID();
  const run = await start(ingestWorkflow, [controlRunId]);

  return Response.json({
    ok: true,
    runId: run.runId,
    controlRunId,
    message: 'Ingest workflow started',
  });
}

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1' || url.searchParams.get('force') === 'true';
  if (!force) {
    const controller = await getFrontPageController();
    const decision = await shouldStartScheduledIngest(controller);
    if (!decision.shouldStart) {
      return Response.json({
        ok: true,
        skipped: true,
        reason: decision.reason,
        lastRunAt: decision.lastRunAt,
        nextDueAt: decision.nextDueAt,
        schedule: {
          every: controller.scheduleEvery,
          unit: controller.scheduleUnit,
        },
      });
    }
  }

  console.log(force ? '[ingest] Forced workflow trigger via GET' : '[ingest] Scheduled workflow trigger via GET');
  const controlRunId = crypto.randomUUID();
  const run = await start(ingestWorkflow, [controlRunId]);

  return Response.json({
    ok: true,
    runId: run.runId,
    controlRunId,
    message: force ? 'Ingest workflow started (forced trigger)' : 'Ingest workflow started (scheduled trigger)',
  });
}
