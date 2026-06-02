import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  Gauge,
  Layers3,
  Radio,
  ScanLine,
  SquarePlay,
  StopCircle,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import { AutoRefresh } from '@/components/admin/auto-refresh';
import { SubmitActionButton } from '@/components/admin/submit-action-button';
import { EventTicker, PipelineConveyor, SystemPanel } from '@/components/system/live-system-visuals';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createServiceClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { requestStopIngest, startManualIngest } from '../../actions';

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
  config: Record<string, unknown> | null;
};

type ItemRow = {
  id: string;
  title: string;
  source_type: string;
  source_name: string | null;
  score: number | null;
  score_breakdown: Record<string, unknown> | null;
  summary: string | null;
  url: string;
  status: string;
  created_at: string;
  scored_at: string | null;
};

type EventRow = {
  id: string;
  workflow_run_id: string | null;
  step: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  source_type: string | null;
  source_name: string | null;
  item_id: string | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
};

export default async function SurveillancePage() {
  const supabase = createServiceClient();

  const [
    feedsRes,
    runsRes,
    recentItemsRes,
    pendingUnscored,
    pendingScored,
    rejectedTotal,
    controlRes,
    eventsRes,
  ] = await Promise.all([
    supabase.from('aitea_feeds').select('id, type, name, url, active, last_fetched_at, config').order('type').order('name'),
    supabase
      .from('aitea_workflow_runs')
      .select('id, workflow_run_id, status, items_fetched, items_scored, errors, started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(12),
    supabase
      .from('aitea_news_items')
      .select('id, title, source_type, source_name, score, score_breakdown, summary, url, status, created_at, scored_at')
      .order('created_at', { ascending: false })
      .limit(24),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('score', null),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').not('score', 'is', null),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('aitea_knowledge_blocks').select('content_json').eq('category', 'ingest_control').maybeSingle(),
    supabase
      .from('aitea_ingest_events')
      .select('id, workflow_run_id, step, level, message, source_type, source_name, item_id, metrics, created_at')
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  const feeds = (feedsRes.data ?? []) as FeedRow[];
  const runs = (runsRes.data ?? []) as RunRow[];
  const items = (recentItemsRes.data ?? []) as ItemRow[];
  const events = (eventsRes.data ?? []) as EventRow[];
  const latestRun = runs[0];
  const running = latestRun?.status === 'running';
  const stopRequested = (controlRes.data?.content_json as { stopRequested?: boolean } | null)?.stopRequested === true;
  const activeFeeds = feeds.filter((feed) => feed.active);
  const totalWords = items.reduce((sum, item) => sum + wordCount(item.title) + wordCount(item.summary), 0);
  const eventWords = events.reduce((sum, event) => sum + Number(event.metrics?.words ?? 0), 0);
  const estimatedPages = Math.max(1, Math.ceil(totalWords / 450));
  const sourceCounts = countBy(items, 'source_type');
  const scoredCount = items.filter((item) => item.score !== null).length;
  const avgScore = scoredCount
    ? items.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / scoredCount
    : 0;
  const runErrors = runs.flatMap((run) => (run.errors ?? []).map((error) => ({ ...error, run }))).slice(0, 8);
  const engineSteps = buildEngineSteps({
    running,
    stopRequested,
    latestRun,
    activeFeeds: activeFeeds.length,
    unscored: pendingUnscored.count ?? 0,
    scored: pendingScored.count ?? 0,
    recentItems: items.length,
    events,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AutoRefresh intervalMs={3000} />
      <div className="mx-auto w-full max-w-7xl space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-3">
              <ScanLine className="size-6 text-yellow-500 motion-safe:animate-pulse" />
              <h1 className="text-2xl font-bold">Ingest Surveillance</h1>
              <Badge variant={running ? 'default' : 'secondary'}>{latestRun?.status ?? 'idle'}</Badge>
              {stopRequested && <Badge variant="destructive">stop requested</Badge>}
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Live view of the feed engine: source checks, scoring pressure, routing, review backlog,
              rough word/page volume, and recent run telemetry.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={startManualIngest}>
              <SubmitActionButton idleLabel="Run ingest" pendingLabel="Starting..." />
            </form>
            <form action={requestStopIngest}>
              <SubmitActionButton
                idleLabel="Stop scans"
                pendingLabel="Stopping..."
                icon="stop"
                variant="destructive"
              />
            </form>
            <Link href="/admin/operations" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
              Back to console
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <WallMetric icon={<Database className="size-4" />} label="Active feeds" value={activeFeeds.length} />
          <WallMetric icon={<Activity className="size-4" />} label="Fetched last run" value={latestRun?.items_fetched ?? 0} />
          <WallMetric icon={<Gauge className="size-4" />} label="Scored last run" value={latestRun?.items_scored ?? 0} />
          <WallMetric icon={<Clock3 className="size-4" />} label="Awaiting score" value={pendingUnscored.count ?? 0} />
          <WallMetric icon={<CheckCircle2 className="size-4" />} label="Telemetry events" value={events.length} />
          <WallMetric icon={<XCircle className="size-4" />} label="Rejected total" value={rejectedTotal.count ?? 0} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <SystemPanel title="Shared Pipeline Model" variant="admin">
            <PipelineConveyor
              variant="admin"
              stages={[
                { label: 'Fetch', value: latestRun?.items_fetched ?? 0, active: running, tone: 'blue' },
                { label: 'Dedupe', value: items.length, active: running, tone: 'violet' },
                { label: 'Score', value: latestRun?.items_scored ?? 0, active: running || (pendingUnscored.count ?? 0) > 0, tone: 'yellow' },
                { label: 'Review', value: pendingScored.count ?? 0, active: (pendingScored.count ?? 0) > 0, tone: 'green' },
                { label: 'Publish', value: latestRun?.status === 'completed' ? 'gate' : 'idle', active: false, tone: 'green' },
              ]}
            />
          </SystemPanel>

          <SystemPanel title="Ticker Sample" variant="admin">
            {events.length === 0 ? (
              <p className="rounded-md border p-4 text-sm text-muted-foreground">No event ticker rows yet.</p>
            ) : (
              <div className="max-h-36 overflow-hidden">
                <EventTicker events={events} variant="admin" limit={8} />
              </div>
            )}
          </SystemPanel>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TerminalSquare className="size-5" />
                Engine steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {engineSteps.map((step) => (
                <EngineStep key={step.label} {...step} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5" />
                Content volume
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <MiniMetric label="Recent items" value={items.length} />
                <MiniMetric label="Words" value={totalWords} />
                <MiniMetric label="Pages est." value={estimatedPages} />
              </div>
              <ProgressReadout label="Telemetry words" value={eventWords} max={Math.max(totalWords + eventWords, 1)} />
              <ProgressReadout label="Scored sample" value={scoredCount} max={Math.max(items.length, 1)} />
              <ProgressReadout label="Average score" value={avgScore} max={10} precision={1} />
              <div className="grid gap-2">
                {Object.entries(sourceCounts).map(([source, count]) => (
                  <ProgressReadout key={source} label={source} value={count} max={Math.max(items.length, 1)} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              Live event stream
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsRes.error ? (
              <p className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-muted-foreground">
                Telemetry table is not available yet. Apply docs/sql/create_aitea_ingest_events.sql,
                then run ingest again to populate live events.
              </p>
            ) : events.length === 0 ? (
              <p className="rounded-md border p-4 text-sm text-muted-foreground">
                No telemetry events yet. Run ingest once and this stream will fill with source, scoring,
                routing, word-count, and stop events.
              </p>
            ) : (
              <div className="grid gap-2 lg:grid-cols-2">
                {events.slice(0, 24).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-5" />
                Source watch
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {feeds.map((feed) => (
                <div key={feed.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{feed.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{feed.type}</p>
                    </div>
                    <Badge variant={feed.active ? 'default' : 'secondary'}>
                      {feed.active ? 'active' : 'off'}
                    </Badge>
                  </div>
                  <p className="mt-3 truncate font-mono text-[10px] text-muted-foreground">{host(feed.url)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last fetched {feed.last_fetched_at ? formatWhen(feed.last_fetched_at) : 'never'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="size-5" />
                Recent material
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.slice(0, 10).map((item) => {
                const words = wordCount(item.title) + wordCount(item.summary);
                return (
                  <Link
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    className="block rounded-md border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{item.status}</Badge>
                          <span className="text-xs text-muted-foreground">{item.source_name ?? item.source_type}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{words} words</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-medium">{item.title}</p>
                      </div>
                      <span className="font-mono text-lg font-bold text-yellow-500">{item.score ?? '...'}</span>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.map((run) => (
                <div key={run.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                      {run.status}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{formatWhen(run.started_at)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniMetric label="Fetched" value={run.items_fetched} />
                    <MiniMetric label="Scored" value={run.items_scored} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Warnings and stop log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runErrors.length === 0 ? (
                <p className="rounded-md border p-4 text-sm text-muted-foreground">No recent run errors or stop requests.</p>
              ) : (
                runErrors.map((entry, index) => (
                  <div key={`${entry.run.id}-${index}`} className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-destructive">{entry.source ?? 'workflow'}</p>
                      <span className="text-xs text-muted-foreground">{entry.run.status}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {entry.error ?? entry.message ?? 'Unknown warning'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function WallMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-yellow-500/50" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-bold">{Math.round(value * 10) / 10}</p>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold">{Math.round(value * 10) / 10}</p>
    </div>
  );
}

function EngineStep({
  label,
  detail,
  state,
  progress,
}: {
  label: string;
  detail: string;
  state: 'running' | 'done' | 'waiting' | 'stopping' | 'blocked';
  progress: number;
}) {
  const Icon =
    state === 'done' ? CheckCircle2 :
      state === 'stopping' ? StopCircle :
        state === 'blocked' ? AlertTriangle :
          state === 'running' ? Activity :
            Clock3;

  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={state === 'running' ? 'size-4 text-yellow-500 motion-safe:animate-pulse' : 'size-4 text-muted-foreground'} />
          <p className="text-sm font-medium">{label}</p>
        </div>
        <Badge variant={state === 'blocked' || state === 'stopping' ? 'destructive' : state === 'done' ? 'default' : 'secondary'}>
          {state}
        </Badge>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-yellow-500 transition-all motion-safe:animate-pulse"
          style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ProgressReadout({
  label,
  value,
  max,
  precision = 0,
}: {
  label: string;
  value: number;
  max: number;
  precision?: number;
}) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="capitalize text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(precision)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500/80 transition-all" style={{ width: `${Math.max(3, percent)}%` }} />
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const tone =
    event.level === 'error' ? 'border-destructive/30 bg-destructive/5' :
      event.level === 'warning' ? 'border-yellow-500/40 bg-yellow-500/10' :
        event.level === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' :
          '';
  const metrics = compactMetrics(event.metrics);

  return (
    <div className={cn('rounded-md border p-3', tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={event.level === 'error' ? 'destructive' : event.level === 'success' ? 'default' : 'secondary'}>
              {event.level}
            </Badge>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {event.step}
            </span>
            {event.source_name && <span className="truncate text-xs text-muted-foreground">{event.source_name}</span>}
          </div>
          <p className="mt-2 text-sm leading-5">{event.message}</p>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatWhen(event.created_at)}</span>
      </div>
      {metrics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {metrics.map(([key, value]) => (
            <span key={key} className="rounded border bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground">
              {key}: {String(value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function buildEngineSteps({
  running,
  stopRequested,
  latestRun,
  activeFeeds,
  unscored,
  scored,
  recentItems,
  events,
}: {
  running: boolean;
  stopRequested: boolean;
  latestRun?: RunRow;
  activeFeeds: number;
  unscored: number;
  scored: number;
  recentItems: number;
  events: EventRow[];
}) {
  const stopping = stopRequested;
  const latestByPrefix = (prefix: string) => events.find((event) => event.step.startsWith(prefix));

  return [
    {
      label: 'Controller gate',
      state: stopping ? 'stopping' : running ? 'running' : 'done',
      progress: stopping ? 35 : running ? 70 : 100,
      detail: latestByPrefix('controller')?.message ?? (stopping ? 'Stop requested. The workflow will halt at the next checkpoint.' : `${activeFeeds} active feeds are eligible for the run.`),
    },
    {
      label: 'Source fetch',
      state: stopping ? 'stopping' : running ? 'running' : latestRun?.items_fetched ? 'done' : 'waiting',
      progress: running ? 65 : latestRun?.items_fetched ? 100 : 12,
      detail: latestByPrefix('fetch')?.message ?? `${latestRun?.items_fetched ?? 0} items fetched on the latest recorded run.`,
    },
    {
      label: 'De-dupe and memory',
      state: running ? 'running' : 'done',
      progress: running ? 58 : 100,
      detail: 'Canonical URLs and prior-seen records suppress repeated scans and duplicate stories.',
    },
    {
      label: 'Quality Manager scoring',
      state: stopping ? 'stopping' : running || unscored > 0 ? 'running' : 'done',
      progress: unscored > 0 ? 42 : latestRun?.items_scored ? 100 : 24,
      detail: latestByPrefix('score')?.message ?? `${unscored} unscored candidates. ${latestRun?.items_scored ?? 0} scored on the latest run.`,
    },
    {
      label: 'Route and front-page eligibility',
      state: stopping ? 'stopping' : scored > 0 ? 'running' : 'waiting',
      progress: scored > 0 ? 72 : 18,
      detail: latestByPrefix('route')?.message ?? `${scored} scored items are waiting for review or routing decisions.`,
    },
    {
      label: 'Review surface',
      state: recentItems > 0 ? 'running' : 'waiting',
      progress: recentItems > 0 ? 76 : 10,
      detail: `${recentItems} recent items are visible in the surveillance sample.`,
    },
  ] as Array<{
    label: string;
    state: 'running' | 'done' | 'waiting' | 'stopping' | 'blocked';
    progress: number;
    detail: string;
  }>;
}

function compactMetrics(metrics: Record<string, unknown> | null | undefined) {
  if (!metrics) return [];
  return Object.entries(metrics)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .slice(0, 6);
}

function countBy<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key]);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function wordCount(...values: Array<string | null | undefined>) {
  return values.join(' ').trim().split(/\s+/).filter(Boolean).length;
}

function host(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
