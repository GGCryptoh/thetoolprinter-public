'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Database, ImageIcon, Loader2, Route, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PipelineRunStartResult = {
  ok: boolean;
  alreadyRunning?: boolean;
  controlRunId: string | null;
  workflowRunId: string | null;
  phases: Record<string, boolean>;
  queueItemLimit: number | null;
};

type PipelineRunDialogProps = {
  awaitingScore: number;
  awaitingRoute: number;
  activeFeeds: number;
};

type ProgressEvent = {
  id: string;
  step: string;
  level: string;
  message: string;
  metrics: Record<string, unknown> | null;
  created_at: string;
};

type ScoredEvent = {
  id: string;
  itemId: string | null;
  message: string;
  score: number | null;
  createdAt: string;
};

type ProgressPayload = {
  ok: boolean;
  run: {
    status: string;
    items_fetched: number | null;
    items_scored: number | null;
    errors: unknown[] | null;
    completed_at: string | null;
  } | null;
  events: ProgressEvent[];
  scoredEvents: ScoredEvent[];
  counts: {
    awaitingScore: number;
    awaitingReview: number;
  };
};

const phaseOptions = [
  {
    name: 'fetch',
    label: 'Fetch new items',
    detail: 'Pull from active feeds before scoring.',
    icon: Database,
  },
  {
    name: 'score',
    label: 'Score queued items',
    detail: 'Run the Quality Manager on pending unscored items.',
    icon: Clock3,
  },
  {
    name: 'route',
    label: 'Route scored items',
    detail: 'Apply thresholds and move scored items toward review.',
    icon: Route,
  },
  {
    name: 'images',
    label: 'Fetch images',
    detail: 'Fill missing Open Graph images for items.',
    icon: ImageIcon,
  },
];

const phaseSteps: Record<string, string[]> = {
  fetch: ['fetch'],
  score: ['score', 'score:batch', 'score:item', 'score:usage'],
  route: ['route'],
  images: ['images', 'og-images'],
};

export function PipelineRunDialog({
  awaitingScore,
  awaitingRoute,
  activeFeeds,
}: PipelineRunDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'choose' | 'running' | 'complete' | 'failed'>('choose');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startResult, setStartResult] = useState<PipelineRunStartResult | null>(null);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);

  const selectedPhases = startResult?.phases ?? {};
  const activePhaseNames = phaseOptions
    .filter((phase) => selectedPhases[phase.name])
    .map((phase) => phase.name);

  const progressPercent = useMemo(() => {
    if (!progress || activePhaseNames.length === 0) return mode === 'choose' ? 0 : 8;
    const completed = activePhaseNames.filter((phase) =>
      progress.events.some((event) => phaseSteps[phase]?.includes(event.step))
    ).length;
    const base = Math.round((completed / activePhaseNames.length) * 88);
    return progress.run?.completed_at ? 100 : Math.max(8, Math.min(96, base));
  }, [activePhaseNames, mode, progress]);

  useEffect(() => {
    if (!startResult?.controlRunId || mode === 'choose' || mode === 'complete' || mode === 'failed') return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/admin/pipeline-progress?controlRunId=${startResult.controlRunId}`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Progress endpoint returned HTTP ${response.status}.`);
        const payload = (await response.json()) as ProgressPayload;
        if (cancelled) return;
        setProgress(payload);
        if (payload.run?.status === 'completed') setMode('complete');
        if (payload.run?.status === 'failed') setMode('failed');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load run progress.');
      }
    };

    poll();
    const id = window.setInterval(poll, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mode, startResult?.controlRunId]);

  function reset() {
    setMode('choose');
    setError(null);
    setStartResult(null);
    setProgress(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && mode !== 'running') reset();
  }

  function startRun(formData: FormData) {
    setError(null);
    setMode('running');
    setProgress(null);
    setStartResult(null);
    setIsStarting(true);

    void (async () => {
      try {
        const result = await startPipelineRun(formData);
        if (!result?.ok || !result.controlRunId) {
          throw new Error('Pipeline did not return a run id.');
        }
        setStartResult(result);
      } catch (err) {
        setMode('failed');
        setError(err instanceof Error ? err.message : 'Could not start pipeline run.');
      } finally {
        setIsStarting(false);
      }
    })();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <Activity className="mr-2 size-3.5" />
        Run pipeline
      </DialogTrigger>
      <DialogContent className="max-h-[min(860px,calc(100vh-2rem))] overflow-hidden sm:max-w-2xl">
        {mode === 'choose' ? (
          <RunChooser
            activeFeeds={activeFeeds}
            awaitingRoute={awaitingRoute}
            awaitingScore={awaitingScore}
            isPending={isStarting}
            onSubmit={startRun}
          />
        ) : (
          <RunProgress
            activePhaseNames={activePhaseNames}
            error={error}
            mode={mode}
            progress={progress}
            progressPercent={progressPercent}
            runId={startResult?.controlRunId ?? null}
            starting={isStarting && !startResult}
            onRunAnother={reset}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

async function startPipelineRun(formData: FormData): Promise<PipelineRunStartResult> {
  const response = await fetch('/api/admin/pipeline-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phases: {
        fetch: formData.get('fetch') === 'on',
        score: formData.get('score') === 'on',
        route: formData.get('route') === 'on',
        images: formData.get('images') === 'on',
      },
      queueItemLimit: Number(formData.get('queueItemLimit')),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? `Pipeline start returned HTTP ${response.status}.`);
  }
  return payload as PipelineRunStartResult;
}

function RunChooser({
  activeFeeds,
  awaitingScore,
  awaitingRoute,
  isPending,
  onSubmit,
}: {
  activeFeeds: number;
  awaitingScore: number;
  awaitingRoute: number;
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  const defaultQueueItemLimit = Math.max(1, Math.min(awaitingScore || 25, 25));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Run Pipeline Phases</DialogTitle>
        <DialogDescription>
          Choose the phases for this manual run. Scheduled runs still use the full pipeline.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="phasePicker" value="1" />
        <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground sm:grid-cols-3">
          <span>{activeFeeds} active feeds</span>
          <span>{awaitingScore} awaiting score</span>
          <span>{awaitingRoute} awaiting route</span>
        </div>

        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-center">
          <div>
            <Label htmlFor="pipeline-queue-item-limit" className="text-sm font-medium">
              Queue items to process
            </Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Caps how many queued posts get scored, routed, or enriched in this manual run.
            </p>
          </div>
          <Input
            id="pipeline-queue-item-limit"
            name="queueItemLimit"
            type="number"
            min={1}
            max={500}
            step={1}
            defaultValue={defaultQueueItemLimit}
            inputMode="numeric"
          />
        </div>

        <div className="space-y-2">
          {phaseOptions.map((phase) => {
            const Icon = phase.icon;
            const defaultChecked = phase.name !== 'fetch';
            return (
              <label
                key={phase.name}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/30"
              >
                <input
                  type="checkbox"
                  name={phase.name}
                  defaultChecked={defaultChecked}
                  className="mt-1 size-4 rounded border-input"
                />
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{phase.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{phase.detail}</span>
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 size-3.5 motion-safe:animate-spin" /> : <Activity className="mr-2 size-3.5" />}
            {isPending ? 'Starting...' : 'Start selected phases'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function RunProgress({
  activePhaseNames,
  error,
  mode,
  progress,
  progressPercent,
  runId,
  starting,
  onRunAnother,
}: {
  activePhaseNames: string[];
  error: string | null;
  mode: 'running' | 'complete' | 'failed';
  progress: ProgressPayload | null;
  progressPercent: number;
  runId: string | null;
  starting: boolean;
  onRunAnother: () => void;
}) {
  const statusLabel = mode === 'complete' ? 'Complete' : mode === 'failed' ? 'Failed' : starting ? 'Starting' : 'Running';
  const scoredEvents = progress?.scoredEvents ?? [];
  const events = progress?.events ?? [];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {mode === 'complete' ? (
            <CheckCircle2 className="size-5 text-emerald-500" />
          ) : mode === 'failed' ? (
            <XCircle className="size-5 text-destructive" />
          ) : (
            <Loader2 className="size-5 motion-safe:animate-spin" />
          )}
          Pipeline Progress
        </DialogTitle>
        <DialogDescription>
          Live run telemetry, score events, routing motion, and queue pressure.
          {runId && <span className="mt-1 block font-mono text-[11px]">Run: {runId}</span>}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 overflow-y-auto pr-1">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{statusLabel}</span>
            <span className="font-mono text-xs text-muted-foreground">{progressPercent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <span>{progress?.run?.items_fetched ?? 0} fetched</span>
            <span>{progress?.run?.items_scored ?? scoredEvents.length} scored</span>
            <span>{progress?.counts.awaitingScore ?? '...'} awaiting score</span>
            <span>{progress?.counts.awaitingReview ?? '...'} awaiting review</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {phaseOptions.map((phase) => {
            const selected = activePhaseNames.includes(phase.name);
            const seen = selected && events.some((event) => phaseSteps[phase.name]?.includes(event.step));
            return (
              <div key={phase.name} className="rounded-md border p-3">
                <p className="text-xs font-medium">{phase.label}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {!selected ? 'Skipped' : seen ? 'In motion' : 'Waiting'}
                </p>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Scores landing</h3>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
              {scoredEvents.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Waiting for the first scored article...</p>
              ) : (
                scoredEvents.map((event) => (
                  <div key={event.id} className="rounded-md bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm">{event.message}</p>
                      <span className="shrink-0 font-mono text-sm font-bold">
                        {typeof event.score === 'number' ? event.score.toFixed(1) : '--'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatTime(event.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Latest events</h3>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
              {events.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  {runId ? 'Waiting for this run to write its first event...' : 'Starting workflow...'}
                </p>
              ) : (
                events.slice(0, 12).map((event) => (
                  <div key={event.id} className="rounded-md bg-muted/30 p-2">
                    <p className="text-xs font-medium">{event.step}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.message}</p>
                    {typeof event.metrics?.error === 'string' && (
                      <p className="mt-1 line-clamp-3 text-[11px] text-destructive">{event.metrics.error}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {(mode === 'complete' || mode === 'failed') && (
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onRunAnother}>
            Run another selection
          </Button>
        </DialogFooter>
      )}
    </>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}
