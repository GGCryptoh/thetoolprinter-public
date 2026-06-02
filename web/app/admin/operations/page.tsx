import Link from 'next/link';
import { connection } from 'next/server';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  Gauge,
  ListChecks,
  Radio,
  Sparkles,
  SquarePlay,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createServiceClient } from '@/lib/supabase/server';
import { AutoRefresh } from '@/components/admin/auto-refresh';
import { PipelineRunDialog } from '@/components/admin/pipeline-run-dialog';
import { SubmitActionButton } from '@/components/admin/submit-action-button';
import { cn } from '@/lib/utils';
import {
  requestStopIngest,
  startManualPeopleStats,
  setLogRetention,
  pruneLogsByAge,
  pruneLogsByCount,
} from '../actions';
import { countIngestEvents } from '@/lib/workflow/metrics-rollup';
import { getLogRetentionDays } from '@/lib/setup/state';

type RunRow = {
  id: string;
  workflow_run_id: string | null;
  status: string;
  items_fetched: number;
  items_scored: number;
  errors: Array<{ source?: string; error?: string; message?: string }> | null;
  started_at: string;
  completed_at: string | null;
};

type FeedRow = {
  id: string;
  type: string;
  name: string;
  url: string;
  active: boolean;
  last_fetched_at: string | null;
  config: Record<string, unknown>;
};

export default async function OperationsPage() {
  await connection();
  const supabase = createServiceClient();

  const [
    feedsRes,
    runsRes,
    pendingUnscored,
    pendingScored,
    approvedToday,
    rejectedRecent,
    recentPendingRes,
    recentRejectedRes,
  ] = await Promise.all([
    supabase.from('aitea_feeds').select('id, type, name, url, active, last_fetched_at, config').order('type').order('name'),
    supabase
      .from('aitea_workflow_runs')
      .select('id, workflow_run_id, status, items_fetched, items_scored, errors, started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(8),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('score', null),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').not('score', 'is', null),
    supabase
      .from('aitea_news_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('reviewed_at', startOfToday()),
    supabase
      .from('aitea_news_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'rejected')
      .gte('reviewed_at', daysAgo(7)),
    supabase
      .from('aitea_news_items')
      .select('id, title, source_type, source_name, score, score_breakdown, summary, url, created_at, scored_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('aitea_news_items')
      .select('id, title, source_type, source_name, score, score_breakdown, summary, url, reviewed_at')
      .eq('status', 'rejected')
      .order('reviewed_at', { ascending: false })
      .limit(6),
  ]);

  const feeds = (feedsRes.data ?? []) as FeedRow[];
  const runs = (runsRes.data ?? []) as RunRow[];
  const latestRun = runs[0];
  const running = latestRun?.status === 'running';
  const activeFeeds = feeds.filter((feed) => feed.active);
  const sourceCounts = countBy(feeds, 'type');
  const latestErrors = runs.flatMap((run) => (run.errors ?? []).map((error) => ({ ...error, run }))).slice(0, 8);
  const pendingItems = recentPendingRes.data ?? [];
  const rejectedItems = recentRejectedRes.data ?? [];

  const stages = buildStages({
    running,
    latestRun,
    unscored: pendingUnscored.count ?? 0,
    scored: pendingScored.count ?? 0,
  });

  const [logCount, retentionDays] = await Promise.all([countIngestEvents(), getLogRetentionDays()]);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={10000} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Operations Console</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Manual feed testing, live workflow progress, queue motion, scoring anticipation,
            and rejection/error visibility for fully automated editorial flows.
          </p>
        </div>
        <Badge variant={running ? 'default' : 'secondary'} className="gap-2">
          <span className={running ? 'size-2 rounded-full bg-emerald-400 motion-safe:animate-pulse' : 'size-2 rounded-full bg-muted-foreground'} />
          {running ? 'Pipeline running' : 'Pipeline idle'}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <MetricCard icon={<Database className="size-4" />} label="Active feeds" value={activeFeeds.length} />
        <MetricCard icon={<Clock3 className="size-4" />} label="Awaiting score" value={pendingUnscored.count ?? 0} />
        <MetricCard icon={<Gauge className="size-4" />} label="Awaiting review" value={pendingScored.count ?? 0} />
        <MetricCard icon={<CheckCircle2 className="size-4" />} label="Approved today" value={approvedToday.count ?? 0} />
        <MetricCard icon={<XCircle className="size-4" />} label="Rejected 7d" value={rejectedRecent.count ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" /> Logs &amp; retention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            The ingest-event log currently holds <strong>{logCount.toLocaleString()}</strong> rows.
            Daily totals are rolled up to <code>aitea_daily_metrics</code> (cron) so logs can be
            pruned without losing cost/volume history.
          </p>

          <form action={setLogRetention} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="logRetentionDays" className="text-xs font-medium">
                Auto-prune logs older than (days, 0 = keep all)
              </label>
              <input
                id="logRetentionDays"
                name="logRetentionDays"
                type="number"
                min={0}
                max={3650}
                defaultValue={retentionDays}
                className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              />
            </div>
            <SubmitActionButton idleLabel="Save retention" pendingLabel="Saving…" icon="refresh" variant="outline" />
          </form>

          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-xs text-destructive">
              ⚠ Pruning permanently deletes raw log rows. Make sure the daily roll-up has run first
              (it preserves the aggregated metrics).
            </p>
            <div className="mt-3 flex flex-wrap gap-6">
              <form action={pruneLogsByAge} className="flex items-end gap-2">
                <div className="space-y-1">
                  <label htmlFor="olderThanDays" className="text-xs font-medium">Delete logs older than (days)</label>
                  <input
                    id="olderThanDays"
                    name="olderThanDays"
                    type="number"
                    min={1}
                    defaultValue={30}
                    className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  />
                </div>
                <SubmitActionButton idleLabel="Prune by age" pendingLabel="Pruning…" icon="stop" variant="destructive" />
              </form>
              <form action={pruneLogsByCount} className="flex items-end gap-2">
                <div className="space-y-1">
                  <label htmlFor="deleteOldest" className="text-xs font-medium">Delete oldest N rows</label>
                  <input
                    id="deleteOldest"
                    name="deleteOldest"
                    type="number"
                    min={1}
                    defaultValue={1000}
                    className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  />
                </div>
                <SubmitActionButton idleLabel="Prune oldest" pendingLabel="Pruning…" icon="stop" variant="destructive" />
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className={running ? 'h-1 bg-emerald-400 motion-safe:animate-pulse' : 'h-1 bg-yellow-500/50'} />
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-5" />
                  Run controls and progress
                </CardTitle>
                <div className="flex gap-2">
                  <PipelineRunDialog
                    activeFeeds={activeFeeds.length}
                    awaitingScore={pendingUnscored.count ?? 0}
                    awaitingRoute={pendingScored.count ?? 0}
                  />
                  <form action={requestStopIngest}>
                    <SubmitActionButton
                      idleLabel="Stop scans"
                      pendingLabel="Requesting stop..."
                      icon="stop"
                      variant="destructive"
                    />
                  </form>
                  <Link
                    href="/admin/operations/surveillance"
                    target="_blank"
                    className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                  >
                    <Activity className="mr-2 size-3.5" />
                    Open surveillance
                  </Link>
                  <form action={startManualPeopleStats}>
                    <SubmitActionButton
                      idleLabel="Refresh people stats"
                      pendingLabel="Refreshing..."
                      icon="refresh"
                      variant="outline"
                    />
                  </form>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-5">
                {stages.map((stage) => (
                  <StageCard key={stage.label} {...stage} />
                ))}
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-medium">Agent readout</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {running
                    ? 'The workflow is in motion. Expect source fetches first, then de-dupe, Quality Manager scoring, routing, and human review.'
                    : pendingUnscored.count
                      ? `${pendingUnscored.count} item${pendingUnscored.count === 1 ? '' : 's'} are waiting for Quality Manager scoring on the next run.`
                      : pendingScored.count
                        ? `${pendingScored.count} scored item${pendingScored.count === 1 ? '' : 's'} are ready for human review.`
                        : 'The queue is calm. Run ingest manually or wait for the next scheduled wakeup.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-5" />
                Queue in motion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending items right now.</p>
              ) : (
                pendingItems.map((item) => {
                  const breakdown = item.score_breakdown as Record<string, unknown> | null;
                  return (
                    <Link
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      className="block rounded-md border p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{item.source_type}</Badge>
                            {item.source_name && <span className="text-xs text-muted-foreground">{item.source_name}</span>}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-medium">{item.title}</p>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {String(breakdown?.qualityReason ?? item.summary ?? 'Awaiting scorecard.')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-2xl font-bold">{item.score ?? '...'}</span>
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {item.score === null ? 'scoring next' : 'review'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
              <div className="flex justify-end">
                <Link href="/admin/queue" className="text-sm text-muted-foreground hover:text-foreground">
                  Open review queue →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="size-5" />
                Rejected and error logs
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recent rejects</p>
                {rejectedItems.length === 0 ? (
                  <p className="rounded-md border p-4 text-sm text-muted-foreground">No recent rejected items.</p>
                ) : (
                  rejectedItems.map((item) => (
                    <Link key={item.id} href={item.url} target="_blank" className="block rounded-md border p-3 hover:bg-muted/40">
                      <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Score {item.score ?? '?'} · {item.source_name ?? item.source_type}
                      </p>
                    </Link>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Run errors</p>
                {latestErrors.length === 0 ? (
                  <p className="rounded-md border p-4 text-sm text-muted-foreground">No recent run errors.</p>
                ) : (
                  latestErrors.map((entry, index) => (
                    <div key={`${entry.run.id}-${index}`} className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-sm font-medium text-destructive">{entry.source ?? 'workflow'}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{entry.error ?? entry.message ?? 'Unknown error'}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="size-5" />
                Source readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SourceRow icon={<Database className="size-4" />} label="RSS" count={sourceCounts.rss ?? 0} />
              <SourceRow icon={<SquarePlay className="size-4" />} label="YouTube" count={sourceCounts.youtube ?? 0} />
              <SourceRow icon={<Radio className="size-4" />} label="X/Twitter" count={sourceCounts.twitter ?? 0} />
              <SourceRow icon={<Sparkles className="size-4" />} label="GitHub" count={sourceCounts.github ?? 0} />
              <div className="pt-2">
                <Link href="/admin/feeds" className="text-sm text-muted-foreground hover:text-foreground">
                  Manage feeds →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent workflow runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workflow runs logged yet.</p>
              ) : (
                runs.map((run) => (
                  <div key={run.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                        {run.status}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">{formatWhen(run.started_at)}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {run.items_fetched} fetched / {run.items_scored} scored
                    </p>
                    {run.workflow_run_id && (
                      <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                        {run.workflow_run_id}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-yellow-500/40" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StageCard({
  label,
  state,
  detail,
}: {
  label: string;
  state: 'done' | 'running' | 'waiting' | 'blocked';
  detail: string;
}) {
  const icon =
    state === 'done' ? <CheckCircle2 className="size-4 text-emerald-500" /> :
      state === 'blocked' ? <AlertTriangle className="size-4 text-destructive" /> :
        state === 'running' ? <Activity className="size-4 text-yellow-500 motion-safe:animate-pulse" /> :
          <Clock3 className="size-4 text-muted-foreground" />;

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function SourceRow({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        {label}
      </div>
      <Badge variant={count > 0 ? 'default' : 'secondary'}>{count}</Badge>
    </div>
  );
}

function buildStages({
  running,
  latestRun,
  unscored,
  scored,
}: {
  running: boolean;
  latestRun?: RunRow;
  unscored: number;
  scored: number;
}) {
  return [
    {
      label: 'Fetch',
      state: running ? 'running' : latestRun?.items_fetched ? 'done' : 'waiting',
      detail: running ? 'Checking configured feeds now.' : `${latestRun?.items_fetched ?? 0} items fetched last run.`,
    },
    {
      label: 'De-dupe',
      state: running ? 'running' : 'done',
      detail: 'Canonical URLs suppress repeats before review.',
    },
    {
      label: 'Quality score',
      state: running || unscored > 0 ? 'running' : 'done',
      detail: unscored > 0 ? `${unscored} candidate${unscored === 1 ? '' : 's'} waiting.` : 'No unscored backlog.',
    },
    {
      label: 'Route',
      state: running ? 'waiting' : scored > 0 ? 'running' : 'done',
      detail: scored > 0 ? `${scored} scored item${scored === 1 ? '' : 's'} need review.` : 'Threshold routing is clear.',
    },
    {
      label: 'Human review',
      state: scored > 0 ? 'running' : 'waiting',
      detail: scored > 0 ? 'Admin judgment needed.' : 'No review pressure.',
    },
  ] as Array<{ label: string; state: 'done' | 'running' | 'waiting' | 'blocked'; detail: string }>;
}

function countBy<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key]);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
