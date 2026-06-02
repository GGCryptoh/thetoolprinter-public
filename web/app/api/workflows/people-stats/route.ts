import { start } from 'workflow/api';
import { peopleStatsWorkflow } from '@/lib/workflow/people-stats';

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const run = await start(peopleStatsWorkflow);

  return Response.json({
    ok: true,
    runId: run.runId,
    message: 'People stats workflow started',
  });
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (token !== cronSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[people-stats] Manual workflow trigger via GET');
  const run = await start(peopleStatsWorkflow);

  return Response.json({
    ok: true,
    runId: run.runId,
    message: 'People stats workflow started (manual trigger)',
  });
}
