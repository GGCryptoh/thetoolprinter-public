import { start } from 'workflow/api';
import { getFrontPageController } from '@/lib/front-page/controller';
import { ingestWorkflow } from '@/lib/workflow/ingest';
import { shouldStartScheduledIngest } from '@/lib/workflow/schedule';

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

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
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const url = new URL(req.url);
  if (cronSecret) {
    const token = url.searchParams.get('token');
    if (token !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

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
