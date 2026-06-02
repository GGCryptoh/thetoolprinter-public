import Link from 'next/link';
import { connection } from 'next/server';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Gauge,
  ListChecks,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { PipelineRunDialog } from '@/components/admin/pipeline-run-dialog';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RunRow = {
  id: string;
  status: string;
  items_fetched: number | null;
  items_scored: number | null;
  started_at: string;
  errors: Array<{ source?: string; error?: string; message?: string }> | null;
};

type EventRow = {
  id: string;
  step: string;
  level: string;
  message: string;
  metrics: Record<string, unknown> | null;
  created_at: string;
};

export default async function DashboardPage() {
  await connection();
  const supabase = createServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Only surface errors from the last 24h so resolved/stale failures stop alarming.
  const errorWindowStart = new Date();
  errorWindowStart.setDate(errorWindowStart.getDate() - 1);

  const [
    { count: totalItems },
    { count: awaitingScore },
    { count: awaitingReview },
    { count: approvedToday },
    { count: activeFeeds },
    { data: recentRuns },
    { data: activeModel },
    { data: recentScoreEvents },
    { data: recentErrorEvents },
  ] = await Promise.all([
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('score', null),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').not('score', 'is', null),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('reviewed_at', today.toISOString()),
    supabase.from('aitea_feeds').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase
      .from('aitea_workflow_runs')
      .select('id, status, items_fetched, items_scored, started_at, errors')
      .order('started_at', { ascending: false })
      .limit(5),
    supabase
      .from('aitea_ai_provider_configs')
      .select('provider, selected_model, active_for_scoring, last_checked_at')
      .eq('active_for_scoring', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('aitea_ingest_events')
      .select('id, step, level, message, metrics, created_at')
      .eq('step', 'score:item')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('aitea_ingest_events')
      .select('id, step, level, message, metrics, created_at')
      .eq('level', 'error')
      .gte('created_at', errorWindowStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(4),
  ]);

  const runs = (recentRuns ?? []) as RunRow[];
  const scoreEvents = (recentScoreEvents ?? []) as EventRow[];
  const errorEvents = (recentErrorEvents ?? []) as EventRow[];
  const latestRun = runs[0];
  const running = latestRun?.status === 'running';

  const stats = [
    { label: 'Awaiting Score', value: awaitingScore ?? 0, icon: Clock3, href: '/admin/queue' },
    { label: 'Awaiting Review', value: awaitingReview ?? 0, icon: ShieldCheck, href: '/admin/approvals' },
    { label: 'Approved Today', value: approvedToday ?? 0, icon: CheckCircle2, href: '/' },
    { label: 'Active Feeds', value: activeFeeds ?? 0, icon: Gauge, href: '/admin/feeds' },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Daily operating view for queue pressure, scoring, review, model health, and recent pipeline motion.
          </p>
        </div>
        <Badge variant={running ? 'default' : 'secondary'} className="gap-2">
          <span className={running ? 'size-2 rounded-full bg-emerald-400 motion-safe:animate-pulse' : 'size-2 rounded-full bg-muted-foreground'} />
          {running ? 'Pipeline running' : 'Pipeline idle'}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <PipelineRunDialog
          activeFeeds={activeFeeds ?? 0}
          awaitingScore={awaitingScore ?? 0}
          awaitingRoute={awaitingReview ?? 0}
        />
        <Link href="/admin/queue" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          <ListChecks className="mr-2 size-3.5" />
          Open queue
        </Link>
        <Link href="/admin/approvals" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          <ShieldCheck className="mr-2 size-3.5" />
          Review scored
        </Link>
        <Link href="/admin/ai-providers" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          <Bot className="mr-2 size-3.5" />
          AI model
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="transition-colors hover:bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon className="size-4" />
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              Recent Pipeline Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pipeline runs yet.</p>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <div key={run.id} className="grid gap-3 rounded-md border px-4 py-3 text-sm md:grid-cols-[170px_110px_minmax(0,1fr)] md:items-center">
                    <span className="font-mono text-xs text-muted-foreground">{new Date(run.started_at).toLocaleString()}</span>
                    <StatusBadge status={run.status} />
                    <span className="text-muted-foreground md:text-right">
                      {run.items_fetched ?? 0} fetched / {run.items_scored ?? 0} scored
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="size-5" />
                Active Scoring Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="break-words font-mono text-xs text-muted-foreground">
                {activeModel?.selected_model ?? 'No active model selected'}
              </p>
              <Link href="/admin/ai-providers" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                Change model
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Recent Errors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {errorEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No errors in the last 24 hours.</p>
              ) : (
                errorEvents.map((event) => (
                  <div key={event.id} className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs font-medium text-destructive">{event.step}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Scores</CardTitle>
        </CardHeader>
        <CardContent>
          {scoreEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent score events.</p>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {scoreEvents.map((event) => (
                <div key={event.id} className="flex items-start justify-between gap-4 rounded-md border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="line-clamp-2">{event.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                  <span className="font-mono text-lg font-bold">{formatScore(event.metrics?.score)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{totalItems ?? 0} total items in the archive.</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge variant="default">completed</Badge>;
  if (status === 'failed') {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="size-3" />
        failed
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

function formatScore(value: unknown) {
  return typeof value === 'number' ? value.toFixed(1) : '--';
}
