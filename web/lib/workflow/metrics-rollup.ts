import { createServiceClient } from '@/lib/supabase/server';

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Aggregate the last `daysBack` days into aitea_daily_metrics (idempotent upsert
 * keyed on date). This is the durable home for cost/volume history so the raw
 * aitea_ingest_events log can be pruned without losing the numbers.
 */
export async function rollupDailyMetrics(daysBack = 3): Promise<number> {
  const supabase = createServiceClient();
  const today = utcDayStart(new Date());

  // Active feed count is "now" (not historical) — good enough for the daily row.
  const { count: feedsActive } = await supabase
    .from('aitea_feeds')
    .select('id', { count: 'exact', head: true })
    .eq('active', true);

  let upserts = 0;
  for (let i = 0; i < daysBack; i++) {
    const dayStart = new Date(today.getTime() - i * DAY_MS);
    const ds = dayStart.toISOString();
    const de = new Date(dayStart.getTime() + DAY_MS).toISOString();
    const dateStr = ds.slice(0, 10);

    const [fetched, scored, approved, rejected, runs, usage] = await Promise.all([
      supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).gte('created_at', ds).lt('created_at', de),
      supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).gte('scored_at', ds).lt('scored_at', de),
      supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('reviewed_at', ds).lt('reviewed_at', de),
      supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'rejected').gte('reviewed_at', ds).lt('reviewed_at', de),
      supabase.from('aitea_workflow_runs').select('id', { count: 'exact', head: true }).gte('started_at', ds).lt('started_at', de),
      supabase.from('aitea_ingest_events').select('metrics').eq('step', 'score:usage').gte('created_at', ds).lt('created_at', de),
    ]);

    let tokens = 0;
    let costUsd = 0;
    for (const row of usage.data ?? []) {
      const m = (row.metrics ?? {}) as Record<string, unknown>;
      tokens += Number(m.totalTokens) || 0;
      costUsd += Number(m.estimatedCostUsd) || 0;
    }

    await supabase.from('aitea_daily_metrics').upsert(
      {
        date: dateStr,
        items_fetched: fetched.count ?? 0,
        items_scored: scored.count ?? 0,
        items_approved: approved.count ?? 0,
        items_rejected: rejected.count ?? 0,
        ai_tokens_used: tokens,
        ai_cost_cents: Math.round(costUsd * 100),
        workflow_runs: runs.count ?? 0,
        feeds_active: feedsActive ?? 0,
      },
      { onConflict: 'date' }
    );
    upserts++;
  }

  return upserts;
}

/** Delete ingest-event log rows older than `olderThanDays`. Returns rows removed. */
export async function pruneIngestEventsByAge(olderThanDays: number): Promise<number> {
  if (!Number.isFinite(olderThanDays) || olderThanDays <= 0) return 0;
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - olderThanDays * DAY_MS).toISOString();
  const { count } = await supabase
    .from('aitea_ingest_events')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);
  return count ?? 0;
}

/** Delete the oldest `deleteCount` ingest-event log rows. Returns rows removed. */
export async function pruneIngestEventsOldest(deleteCount: number): Promise<number> {
  if (!Number.isFinite(deleteCount) || deleteCount <= 0) return 0;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('aitea_ingest_events')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(Math.min(deleteCount, 5000));
  const ids = (data ?? []).map((r) => r.id as string);
  if (ids.length === 0) return 0;
  const { count } = await supabase
    .from('aitea_ingest_events')
    .delete({ count: 'exact' })
    .in('id', ids);
  return count ?? 0;
}

/** Current row count of the ingest-event log (for the admin display). */
export async function countIngestEvents(): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from('aitea_ingest_events')
    .select('id', { count: 'exact', head: true });
  return count ?? 0;
}
