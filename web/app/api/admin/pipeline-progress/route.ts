import { checkAuth } from '@/lib/auth/admin';
import { createServiceClient } from '@/lib/supabase/server';

type EventMetrics = {
  score?: number;
  model?: string;
  batch?: number;
  batchSize?: number;
  totalFetched?: number;
  totalScored?: number;
  routed?: number;
  approved?: number;
  rejected?: number;
  review?: number;
  fetched?: number;
  error?: string;
};

type IngestEventRow = {
  id: string;
  step: string;
  level: string;
  message: string;
  item_id: string | null;
  metrics: EventMetrics | null;
  created_at: string;
};

export async function GET(req: Request) {
  if (!(await checkAuth())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const controlRunId = url.searchParams.get('controlRunId');
  if (!controlRunId) {
    return Response.json({ error: 'Missing controlRunId' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const [runRes, eventsRes, pendingUnscored, pendingScored] = await Promise.all([
    supabase
      .from('aitea_workflow_runs')
      .select('workflow_run_id, status, items_fetched, items_scored, errors, started_at, completed_at')
      .eq('workflow_run_id', controlRunId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('aitea_ingest_events')
      .select('id, step, level, message, item_id, metrics, created_at')
      .eq('workflow_run_id', controlRunId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('score', null),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').not('score', 'is', null),
  ]);

  const events = (eventsRes.data ?? []) as IngestEventRow[];
  const scoredEvents = events
    .filter((event) => event.step === 'score:item')
    .map((event) => ({
      id: event.id,
      itemId: event.item_id,
      message: event.message,
      score: typeof event.metrics?.score === 'number' ? event.metrics.score : null,
      createdAt: event.created_at,
    }));

  return Response.json({
    ok: true,
    run: runRes.data ?? null,
    events,
    scoredEvents,
    counts: {
      awaitingScore: pendingUnscored.count ?? 0,
      awaitingReview: pendingScored.count ?? 0,
    },
  });
}
