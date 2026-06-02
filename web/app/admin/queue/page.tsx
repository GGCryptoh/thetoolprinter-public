import Link from 'next/link';
import { connection } from 'next/server';
import { ArrowRight, CheckCircle2, Clock, Database, Route, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PipelineRunDialog } from '@/components/admin/pipeline-run-dialog';
import { QueuePendingList } from '@/components/admin/queue-pending-list';
import { createServiceClient } from '@/lib/supabase/server';

type QueueItem = {
  id: string;
  title: string;
  source_type: string;
  source_name: string | null;
  score: number | null;
  section: string | null;
  created_at: string;
};

type WorkflowRun = {
  workflow_run_id: string | null;
  status: string;
  items_fetched: number | null;
  items_scored: number | null;
  started_at: string | null;
  completed_at: string | null;
};

export default async function QueuePage() {
  await connection();
  const supabase = createServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    activeFeeds,
    awaitingScore,
    awaitingRoute,
    awaitingReview,
    approvedToday,
    recentItems,
    recentRuns,
  ] = await Promise.all([
    supabase.from('aitea_feeds').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('score', null).is('archived_at', null),
    supabase
      .from('aitea_news_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .not('score', 'is', null)
      .is('section', null)
      .is('archived_at', null),
    supabase
      .from('aitea_news_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .not('score', 'is', null)
      .is('archived_at', null),
    supabase
      .from('aitea_news_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('reviewed_at', today.toISOString()),
    supabase
      .from('aitea_news_items')
      .select('id, title, source_type, source_name, score, section, created_at')
      .eq('status', 'pending')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('aitea_workflow_runs')
      .select('workflow_run_id, status, items_fetched, items_scored, started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(5),
  ]);

  const stages = [
    {
      label: 'Fetch',
      helper: 'Active sources available',
      value: activeFeeds.count ?? 0,
      icon: Database,
      tone: 'text-sky-300',
    },
    {
      label: 'Score',
      helper: 'Fetched but not scored',
      value: awaitingScore.count ?? 0,
      icon: Clock,
      tone: 'text-yellow-300',
    },
    {
      label: 'Route',
      helper: 'Scored, no section yet',
      value: awaitingRoute.count ?? 0,
      icon: Route,
      tone: 'text-violet-300',
    },
    {
      label: 'Review',
      helper: 'Ready for human approval',
      value: awaitingReview.count ?? 0,
      icon: ShieldCheck,
      tone: 'text-emerald-300',
    },
    {
      label: 'Publish',
      helper: 'Approved today',
      value: approvedToday.count ?? 0,
      icon: CheckCircle2,
      tone: 'text-lime-300',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Queue</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            A read-only operational view of what is waiting at each step. Publishing decisions now live in the Human Review Desk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PipelineRunDialog
            activeFeeds={activeFeeds.count ?? 0}
            awaitingScore={awaitingScore.count ?? 0}
            awaitingRoute={awaitingRoute.count ?? 0}
          />
          <Link href="/admin/approvals" className={buttonVariants({ size: 'sm' })}>
            Open Human Review Desk
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <Card key={stage.label} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className={`size-5 ${stage.tone}`} />
                  <span className="font-mono text-[10px] text-muted-foreground">0{index + 1}</span>
                </div>
                <p className="mt-5 font-mono text-4xl font-bold">{stage.value}</p>
                <p className="mt-2 text-sm font-medium">{stage.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stage.helper}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Pending Items</CardTitle>
          </CardHeader>
          <CardContent>
            <QueuePendingList items={(recentItems.data as QueueItem[]) ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!recentRuns.data || recentRuns.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workflow runs recorded yet.</p>
            ) : (
              (recentRuns.data as WorkflowRun[]).map((run, index) => (
                <div key={run.workflow_run_id ?? index} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge status={run.status} />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {run.completed_at ? formatWhen(run.completed_at) : run.started_at ? formatWhen(run.started_at) : 'unknown'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="text-foreground">{run.items_fetched ?? 0}</span> fetched /{' '}
                    <span className="text-foreground">{run.items_scored ?? 0}</span> scored
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

function formatWhen(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
  });
}
