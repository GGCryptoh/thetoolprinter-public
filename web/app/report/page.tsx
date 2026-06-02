import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { cacheLife, cacheTag } from 'next/cache';
import { AutoRefresh } from '@/components/admin/auto-refresh';
import { BackOnEscape } from '@/components/system/back-on-escape';
import { decodeHtmlEntities } from '@/lib/text';
import {
  DecisionStream,
  EventTicker,
  PipelineConveyor,
  SignalBar,
  SystemMetric,
  SystemPanel,
  TrendBars,
} from '@/components/system/live-system-visuals';
import {
  estimateModelCost,
  estimateScoringBatchUsage,
  estimateScrapeCost,
  hostingCostForRange,
} from '@/lib/financials/model-costs';
import { getFrontPageController } from '@/lib/front-page/controller';
import { createServiceClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'System Report — The Tool Printer',
  description:
    'A public transparency screen showing the autonomous intelligence loop: feeds, scoring, approvals, rejects, run history, and live ingest events.',
};

async function getReportData() {
  'use cache';
  cacheLife('minutes');
  cacheTag('report');

  const supabase = createServiceClient();
  const sevenDaysAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = sevenDaysAgoDate.toISOString();

  const [
    totalItems,
    approvedItems,
    rejectedItems,
    pendingItems,
    pendingScored,
    pendingUnscored,
    activeFeeds,
    recentRuns,
    sourceBreakdown,
    pipelineRuns7d,
    recentEvents,
    costEvents,
    scoreData,
    trendData,
    controller,
    queueItems,
    recentDecisions,
  ] = await Promise.all([
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').not('score', 'is', null),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('score', null),
    supabase.from('aitea_feeds').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase
      .from('aitea_workflow_runs')
      .select('workflow_run_id, status, items_fetched, items_scored, errors, started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(8),
    supabase.from('aitea_news_items').select('source_type'),
    supabase.from('aitea_workflow_runs').select('workflow_run_id', { count: 'exact', head: true }).gte('started_at', sevenDaysAgo),
    supabase
      .from('aitea_ingest_events')
      .select('id, step, level, message, source_type, source_name, metrics, created_at')
      .order('created_at', { ascending: false })
      .limit(28),
    supabase
      .from('aitea_ingest_events')
      .select('id, workflow_run_id, step, metrics, created_at')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('aitea_news_items').select('score').not('score', 'is', null),
    supabase
      .from('aitea_news_items')
      .select('status, created_at, reviewed_at')
      .or(`created_at.gte.${sevenDaysAgo},reviewed_at.gte.${sevenDaysAgo}`),
    getFrontPageController(),
    supabase
      .from('aitea_news_items')
      .select('id, title, source_type, source_name, summary, score, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('aitea_news_items')
      .select('id, title, source_type, source_name, score, status, reviewed_at, created_at')
      .in('status', ['approved', 'rejected'])
      .not('reviewed_at', 'is', null)
      .order('reviewed_at', { ascending: false })
      .limit(12),
  ]);

  const sourceCounts: Record<string, number> = {};
  for (const row of sourceBreakdown.data ?? []) {
    const source = String(row.source_type ?? 'unknown');
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
  }

  const scoreBuckets = [
    { label: '0-2', min: 0, max: 2, count: 0 },
    { label: '3-4', min: 3, max: 4, count: 0 },
    { label: '5-6', min: 5, max: 6, count: 0 },
    { label: '7-8', min: 7, max: 8, count: 0 },
    { label: '9-10', min: 9, max: 10, count: 0 },
  ];

  for (const row of scoreData.data ?? []) {
    const score = Number(row.score);
    const bucket = scoreBuckets.find((item) => score >= item.min && score <= item.max);
    if (bucket) bucket.count++;
  }

  return {
    total: totalItems.count ?? 0,
    approved: approvedItems.count ?? 0,
    rejected: rejectedItems.count ?? 0,
    pending: pendingItems.count ?? 0,
    pendingScored: pendingScored.count ?? 0,
    pendingUnscored: pendingUnscored.count ?? 0,
    feedsActive: activeFeeds.count ?? 0,
    runs7d: pipelineRuns7d.count ?? 0,
    recentRuns: (recentRuns.data ?? []) as PipelineRun[],
    sourceEntries: Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]),
    scoreBuckets,
    recentEvents: (recentEvents.data ?? []) as IngestEventItem[],
    recentEventsAvailable: !recentEvents.error,
    financials: buildPublicFinancials((costEvents.data ?? []) as CostEventItem[], sevenDaysAgoDate),
    trendPoints: buildTrendPoints((trendData.data ?? []) as TrendRow[], sevenDaysAgoDate),
    controller,
    queueItems: (queueItems.data ?? []) as QueueItem[],
    recentDecisions: (recentDecisions.data ?? []) as DecisionItem[],
  };
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportFallback />}>
      <ReportContent />
    </Suspense>
  );
}

async function ReportContent() {
  await connection();
  const data = await getReportData();
  const latestRun = data.recentRuns[0];
  const latestEvent = data.recentEvents[0];
  const running = latestRun?.status === 'running';
  const approvalRate =
    data.approved + data.rejected > 0
      ? Math.round((data.approved / (data.approved + data.rejected)) * 100)
      : 0;
  const maxSource = Math.max(...data.sourceEntries.map(([, count]) => count), 1);
  const maxScore = Math.max(...data.scoreBuckets.map((bucket) => bucket.count), 1);

  return (
    <main className="min-h-screen overflow-hidden bg-[#050506] text-neutral-100">
      <BackOnEscape />
      <AutoRefresh intervalMs={10000} />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1880px] flex-col px-4 py-4 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 pb-4">
          <div>
            <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500 hover:text-neutral-200">
              &larr; The Tool Printer
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">System Report</h1>
              <StatusBadge status={latestRun?.status ?? 'idle'} />
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
              Public transparency for the autonomous intelligence loop: what the system watches,
              how it scores, what humans approve, and what the engine is doing now.
            </p>
          </div>
          <div className="grid gap-2 text-right sm:grid-cols-2">
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-yellow-300">Cadence</p>
              <p className="mt-1 text-2xl font-semibold text-white">{formatCadence(data.controller)}</p>
              <p className="mt-1 text-xs text-neutral-500">Hourly clock, controller gated</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">Gate</p>
              <p className="mt-1 text-2xl font-semibold capitalize text-white">{data.controller.publishingGateMode}</p>
              <p className="mt-1 text-xs text-neutral-500">{gateSummary(data.controller)}</p>
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-4 py-4 xl:grid-cols-[1fr_1.45fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <SystemMetric label="Items" value={data.total} />
              <SystemMetric label="Feeds" value={data.feedsActive} tone="blue" />
              <SystemMetric label="Approved" value={data.approved} tone="green" />
              <SystemMetric label="Rejected" value={data.rejected} tone="red" />
              <SystemMetric label="Review" value={data.pendingScored} tone="yellow" />
              <SystemMetric label="Score next" value={data.pendingUnscored} tone="violet" />
            </div>

            <SystemPanel title="Governance State">
              <div className="grid grid-cols-2 gap-3">
                <MiniReadout label="Approval rate" value={`${approvalRate}%`} />
                <MiniReadout label="Runs 7d" value={data.runs7d} />
              </div>
              <div className="mt-4 space-y-3">
                <SystemLine label="Public visibility" value="Enabled" />
                <SystemLine label="Review mode" value={`${data.pendingScored} scored items waiting`} />
                <SystemLine label="Telemetry" value={data.recentEventsAvailable ? 'Streaming' : 'Preparing'} />
              </div>
            </SystemPanel>

            <SystemPanel title="Spend Rate">
              <div className="grid grid-cols-2 gap-3">
                <MiniReadout label="7d total cost" value={money(data.financials.total7d)} />
                <MiniReadout label="Daily avg" value={money(data.financials.totalPerDay)} />
              </div>
              <div className="mt-4 space-y-3">
                <SystemLine label="Model" value={money(data.financials.modelCost7d)} />
                <SystemLine label="Scrape" value={`${money(data.financials.scrapeCost7d)} · ${formatCompact(data.financials.scrapedItems7d)} items`} />
                <SystemLine label="Hosting" value={money(data.financials.hostingCost7d)} />
                <SystemLine label="Monthly pace" value={money(data.financials.monthlyPace)} />
                <SystemLine label="Model tokens" value={formatCompact(data.financials.tokens7d)} />
                <SystemLine label="Basis" value={data.financials.actualCoverage > 0 ? `${data.financials.actualCoverage}% actual usage` : 'estimated from batches'} />
              </div>
              <p className="mt-4 text-xs leading-5 text-neutral-600">
                Public estimate: model scoring, scraping at $1/1k candidates, and $12/month hosting
                allocated by day. Detailed rows stay in the admin ledger.
              </p>
            </SystemPanel>

            <SystemPanel title="Source Mix">
              <div className="space-y-3">
                {data.sourceEntries.slice(0, 6).map(([source, count], index) => (
                  <SignalBar key={source} label={source} value={count} max={maxSource} tone={index === 0 ? 'yellow' : 'neutral'} />
                ))}
              </div>
            </SystemPanel>
          </div>

          <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
            <SystemPanel title="Live Pipeline">
              <PipelineConveyor
                stages={[
                  { label: 'Fetch', value: latestRun?.items_fetched ?? 0, active: running, tone: 'blue' },
                  { label: 'Dedupe', value: data.total, active: running, tone: 'violet' },
                  { label: 'Score', value: latestRun?.items_scored ?? 0, active: data.pendingUnscored > 0 || running, tone: 'yellow' },
                  { label: 'Review', value: data.pendingScored, active: data.pendingScored > 0, tone: 'green' },
                  { label: 'Publish', value: data.approved, active: false, tone: 'green' },
                ]}
              />
              <p className="mt-4 text-sm leading-6 text-neutral-500">
                Latest signal: {latestEvent?.message ?? 'No telemetry event recorded yet.'}
              </p>
            </SystemPanel>

            <SystemPanel title="7-Day Signal">
              <TrendBars points={data.trendPoints} />
              <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                <span><i className="mr-1 inline-block size-2 rounded-sm bg-sky-400" />captured</span>
                <span><i className="mr-1 inline-block size-2 rounded-sm bg-emerald-400" />approved</span>
                <span><i className="mr-1 inline-block size-2 rounded-sm bg-red-400" />rejected</span>
              </div>
            </SystemPanel>

            <SystemPanel title="Event Stream" fill>
              {!data.recentEventsAvailable ? (
                <EmptyState text="Telemetry table is being prepared." />
              ) : data.recentEvents.length === 0 ? (
                <EmptyState text="No ingest events recorded yet." />
              ) : (
                <div className="max-h-[43vh] overflow-hidden">
                  <EventTicker events={data.recentEvents} limit={18} />
                </div>
              )}
            </SystemPanel>

            <SystemPanel title="Decision Stream">
              <DecisionStream decisions={data.recentDecisions.slice(0, 8)} />
            </SystemPanel>
          </div>

          <div className="space-y-4">
            <SystemPanel title="Recent Runs">
              <div className="space-y-2">
                {data.recentRuns.slice(0, 6).map((run, index) => (
                  <RunRow key={run.workflow_run_id ?? index} run={run} />
                ))}
              </div>
            </SystemPanel>

            <SystemPanel title="Score Distribution">
              <div className="space-y-3">
                {data.scoreBuckets.map((bucket) => (
                  <SignalBar key={bucket.label} label={bucket.label} value={bucket.count} max={maxScore} tone={bucket.label === '9-10' ? 'yellow' : 'neutral'} />
                ))}
              </div>
            </SystemPanel>

            <SystemPanel title="Queue In Motion">
              {data.queueItems.length === 0 ? (
                <EmptyState text="No public queue items waiting right now." />
              ) : (
                <div className="space-y-2">
                  {data.queueItems.map((item) => (
                    <div key={item.id} className="rounded-md border border-neutral-800 bg-black/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-neutral-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-300">
                              {item.source_type}
                            </span>
                            <span className="truncate text-xs text-neutral-500">{item.source_name ?? 'source'}</span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-medium text-neutral-200">{decodeHtmlEntities(item.title)}</p>
                        </div>
                        <span className="shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                          {item.score === null ? 'scoring next' : `score ${item.score}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SystemPanel>

            <SystemPanel title="Operating Rules">
              <div className="space-y-3 text-sm leading-6 text-neutral-500">
                <p>Runs gather from active feeds, suppress duplicate URLs, score candidates, and route review-ready items.</p>
                <p>{operatingRule(data.controller)} This page exposes system behavior, not legal, technical, or investment advice.</p>
              </div>
            </SystemPanel>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReportFallback() {
  return (
    <main className="min-h-screen bg-[#050506] px-6 py-8">
      <div className="mx-auto max-w-5xl text-sm text-neutral-400">Loading system report...</div>
    </main>
  );
}

interface PipelineRun {
  workflow_run_id: string | null;
  status: string;
  items_fetched: number | null;
  items_scored: number | null;
  errors: unknown;
  started_at: string | null;
  completed_at: string | null;
}

interface IngestEventItem {
  id: string;
  step: string;
  level: string;
  message: string;
  source_type: string | null;
  source_name: string | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
}

interface CostEventItem {
  id: string;
  workflow_run_id: string | null;
  step: string;
  metrics: Record<string, unknown> | null;
  created_at: string;
}

interface TrendRow {
  status: string;
  created_at: string | null;
  reviewed_at: string | null;
}

interface QueueItem {
  id: string;
  title: string;
  source_type: string;
  source_name: string | null;
  summary: string | null;
  score: number | null;
  created_at: string;
}

interface DecisionItem {
  id: string;
  title: string;
  source_type: string;
  source_name: string | null;
  score: number | null;
  status: 'approved' | 'rejected';
  reviewed_at: string | null;
  created_at: string;
}

function buildPublicFinancials(events: CostEventItem[], startDate: Date) {
  const actualKeys = new Set(
    events
      .filter((event) => event.step === 'score:usage')
      .map((event) => `${event.workflow_run_id ?? 'none'}:${Number(event.metrics?.batch ?? 0)}`)
  );
  let modelCost7d = 0;
  let tokens7d = 0;
  let scrapedItems7d = 0;
  let actual = 0;
  let total = 0;

  for (const event of events) {
    if (new Date(event.created_at) < startDate) continue;
    const metrics = event.metrics ?? {};
    const batch = Number(metrics.batch ?? 0);

    if (event.step === 'score:usage') {
      const cost = estimateModelCost(String(metrics.model ?? 'anthropic/claude-sonnet-4.5'), {
        inputTokens: Number(metrics.inputTokens ?? 0),
        outputTokens: Number(metrics.outputTokens ?? 0),
        totalTokens: Number(metrics.totalTokens ?? 0),
      });
      modelCost7d += Number(metrics.estimatedCostUsd ?? cost.estimatedCostUsd);
      tokens7d += cost.totalTokens;
      actual++;
      total++;
      continue;
    }

    if (event.step === 'score:batch' && !actualKeys.has(`${event.workflow_run_id ?? 'none'}:${batch}`)) {
      const usage = estimateScoringBatchUsage(Number(metrics.words ?? 0), Number(metrics.batchSize ?? 0));
      const cost = estimateModelCost('anthropic/claude-sonnet-4.5', usage);
      modelCost7d += cost.estimatedCostUsd;
      tokens7d += cost.totalTokens;
      total++;
    }

    if (event.step.startsWith('fetch-') && event.step !== 'fetch-og-images') {
      scrapedItems7d += Number(metrics.candidates ?? 0);
    }
  }

  const scrapeCost7d = estimateScrapeCost(scrapedItems7d);
  const hostingCost7d = hostingCostForRange(startDate, new Date());
  const total7d = modelCost7d + scrapeCost7d + hostingCost7d;
  const totalPerDay = total7d / 7;
  return {
    modelCost7d,
    scrapeCost7d,
    hostingCost7d,
    total7d,
    totalPerDay,
    monthlyPace: totalPerDay * 30.44,
    tokens7d,
    scrapedItems7d,
    actualCoverage: total ? Math.round((actual / total) * 100) : 0,
  };
}

function MiniReadout({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-black/30 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function SystemLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right text-neutral-200">{value}</span>
    </div>
  );
}

function RunRow({ run }: { run: PipelineRun }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-black/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={run.status} />
        <time className="font-mono text-[10px] text-neutral-600">
          {run.completed_at ? formatRelative(run.completed_at) : run.started_at ? formatRelative(run.started_at) : 'unknown'}
        </time>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        <span className="text-neutral-300">{run.items_fetched ?? 0}</span> fetched /{' '}
        <span className="text-neutral-300">{run.items_scored ?? 0}</span> scored
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/60',
    running: 'bg-yellow-900/40 text-yellow-300 border-yellow-800/60',
    failed: 'bg-red-900/40 text-red-300 border-red-800/60',
    idle: 'bg-neutral-800 text-neutral-400 border-neutral-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status] ?? styles.idle}`}>
      {status}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md border border-neutral-800 bg-black/30 p-4 text-sm text-neutral-500">{text}</p>;
}

function gateSummary(controller: {
  publishingGateMode: 'human' | 'hybrid' | 'automatic';
  autoApproveThreshold: number;
  autoRejectThreshold: number;
  maxAutoApprovedPerRun: number;
}) {
  if (controller.publishingGateMode === 'human') return 'Manual approval before publish';
  if (controller.publishingGateMode === 'automatic') {
    return `Auto-approve score >= ${controller.autoApproveThreshold}`;
  }
  return `Auto-approve score >= ${controller.autoApproveThreshold}, max ${controller.maxAutoApprovedPerRun}/run`;
}

function operatingRule(controller: {
  publishingGateMode: 'human' | 'hybrid' | 'automatic';
  autoApproveThreshold: number;
  maxAutoApprovedPerRun: number;
}) {
  if (controller.publishingGateMode === 'human') return 'Every published item requires manual approval.';
  if (controller.publishingGateMode === 'automatic') return `Items at or above ${controller.autoApproveThreshold} can publish automatically.`;
  return `Items at or above ${controller.autoApproveThreshold} can auto-publish up to ${controller.maxAutoApprovedPerRun} per run; the rest wait for review.`;
}

function formatCadence(controller: { scheduleEvery: number; scheduleUnit: 'hours' | 'days' | 'weeks' }) {
  const unit = controller.scheduleEvery === 1 ? controller.scheduleUnit.replace(/s$/, '') : controller.scheduleUnit;
  return `Every ${controller.scheduleEvery}${unit === 'hour' ? 'h' : ` ${unit}`}`;
}

function buildTrendPoints(rows: TrendRow[], startDate: Date) {
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index + 1);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
      created: 0,
      approved: 0,
      rejected: 0,
    };
  });

  for (const row of rows) {
    const createdKey = row.created_at?.slice(0, 10);
    const reviewedKey = row.reviewed_at?.slice(0, 10);
    const createdPoint = points.find((point) => point.key === createdKey);
    if (createdPoint) createdPoint.created++;
    const reviewedPoint = points.find((point) => point.key === reviewedKey);
    if (reviewedPoint && row.status === 'approved') reviewedPoint.approved++;
    if (reviewedPoint && row.status === 'rejected') reviewedPoint.rejected++;
  }

  return points.map(({ key: _key, ...point }) => point);
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
