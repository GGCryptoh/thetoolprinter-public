import type { ReactNode } from 'react';
import { decodeHtmlEntities } from '@/lib/text';

type Tone = 'neutral' | 'yellow' | 'green' | 'red' | 'blue' | 'violet';
type Variant = 'dark' | 'admin';

const toneText: Record<Tone, string> = {
  neutral: 'text-neutral-100',
  yellow: 'text-yellow-300',
  green: 'text-emerald-300',
  red: 'text-red-300',
  blue: 'text-sky-300',
  violet: 'text-violet-300',
};

const toneBg: Record<Tone, string> = {
  neutral: 'bg-neutral-500',
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-400',
  red: 'bg-red-400',
  blue: 'bg-sky-400',
  violet: 'bg-violet-400',
};

function shell(variant: Variant) {
  return variant === 'dark'
    ? 'border-neutral-800 bg-neutral-950/60 text-neutral-100'
    : 'border-border bg-card text-card-foreground';
}

function muted(variant: Variant) {
  return variant === 'dark' ? 'text-neutral-500' : 'text-muted-foreground';
}

export function SystemPanel({
  title,
  children,
  variant = 'dark',
  fill,
}: {
  title: string;
  children: ReactNode;
  variant?: Variant;
  fill?: boolean;
}) {
  return (
    <section className={`rounded-md border p-4 ${shell(variant)} ${fill ? 'min-h-0' : ''}`}>
      <div className={`mb-4 flex items-center justify-between border-b pb-3 ${variant === 'dark' ? 'border-neutral-800' : 'border-border'}`}>
        <h2 className={`font-mono text-[10px] uppercase tracking-[0.24em] ${muted(variant)}`}>{title}</h2>
        <span className="size-1.5 rounded-full bg-yellow-400 motion-safe:animate-pulse" />
      </div>
      {children}
    </section>
  );
}

export function SystemMetric({
  label,
  value,
  tone = 'neutral',
  variant = 'dark',
}: {
  label: string;
  value: number | string;
  tone?: Tone;
  variant?: Variant;
}) {
  return (
    <div className={`rounded-md border p-4 ${variant === 'dark' ? 'border-neutral-800 bg-neutral-900/60' : 'border-border bg-muted/20'}`}>
      <p className={`font-mono text-[10px] uppercase tracking-[0.2em] ${muted(variant)}`}>{label}</p>
      <p className={`mt-3 font-mono text-4xl font-bold ${toneText[tone]}`}>{value}</p>
    </div>
  );
}

export function SignalBar({
  label,
  value,
  max,
  tone = 'neutral',
  variant = 'dark',
}: {
  label: string;
  value: number;
  max: number;
  tone?: Tone;
  variant?: Variant;
}) {
  const pct = Math.max(4, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className={`capitalize ${muted(variant)}`}>{label}</span>
        <span className={variant === 'dark' ? 'font-mono text-neutral-100' : 'font-mono'}>{value}</span>
      </div>
      <div className={`h-2 overflow-hidden rounded-full ${variant === 'dark' ? 'bg-neutral-800' : 'bg-muted'}`}>
        <div className={`h-full rounded-full transition-all ${toneBg[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PipelineConveyor({
  stages,
  variant = 'dark',
}: {
  stages: Array<{ label: string; value: number | string; active?: boolean; tone?: Tone }>;
  variant?: Variant;
}) {
  return (
    <div className="relative overflow-hidden rounded-md">
      <div className={`absolute left-0 right-0 top-1/2 h-px ${variant === 'dark' ? 'bg-neutral-800' : 'bg-border'}`} />
      <div className="absolute left-0 top-1/2 h-px w-1/3 -translate-y-px bg-yellow-400/80 blur-[1px] motion-safe:animate-[system-scan_3.8s_linear_infinite]" />
      <div className="relative grid gap-3 md:grid-cols-5">
        {stages.map((stage, index) => {
          const tone = stage.tone ?? 'neutral';
          return (
            <div
              key={stage.label}
              className={`relative rounded-md border p-3 ${variant === 'dark' ? 'border-neutral-800 bg-black/50' : 'border-border bg-background'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${muted(variant)}`}>{stage.label}</span>
                <span className={`size-2 rounded-full ${stage.active ? `${toneBg[tone]} motion-safe:animate-pulse` : variant === 'dark' ? 'bg-neutral-700' : 'bg-muted-foreground/30'}`} />
              </div>
              <p className={`mt-3 font-mono text-2xl font-bold ${variant === 'dark' ? toneText[tone] : ''}`}>{stage.value}</p>
              {index < stages.length - 1 && (
                <span className={`absolute -right-2 top-1/2 hidden size-3 -translate-y-1/2 rotate-45 border-r border-t md:block ${variant === 'dark' ? 'border-neutral-700 bg-black' : 'border-border bg-background'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EventTicker({
  events,
  variant = 'dark',
  limit = 10,
}: {
  events: Array<{
    id: string;
    level: string;
    step: string;
    message: string;
    source_name?: string | null;
    created_at: string;
    metrics?: Record<string, unknown> | null;
  }>;
  variant?: Variant;
  limit?: number;
}) {
  return (
    <div className="relative overflow-hidden">
      <div className="space-y-2 motion-safe:animate-[event-drift_24s_linear_infinite]">
        {events.slice(0, limit).map((event) => (
          <EventTickerRow key={event.id} event={event} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function EventTickerRow({
  event,
  variant,
}: {
  event: {
    level: string;
    step: string;
    message: string;
    source_name?: string | null;
    created_at: string;
    metrics?: Record<string, unknown> | null;
  };
  variant: Variant;
}) {
  const levelTone = event.level === 'error' ? 'red' : event.level === 'warning' ? 'yellow' : event.level === 'success' ? 'green' : 'neutral';
  const metrics = Object.entries(event.metrics ?? {})
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .slice(0, 3);

  return (
    <div className={`rounded-md border p-3 ${variant === 'dark' ? 'border-neutral-800 bg-black/30' : 'border-border bg-background'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${variant === 'dark' ? 'border-neutral-700' : 'border-border'} ${toneText[levelTone]}`}>
              {event.level}
            </span>
            <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${muted(variant)}`}>{event.step}</span>
            {event.source_name && <span className={`truncate text-xs ${muted(variant)}`}>{event.source_name}</span>}
          </div>
          <p className={`mt-2 line-clamp-2 text-sm leading-5 ${variant === 'dark' ? 'text-neutral-300' : ''}`}>{event.message}</p>
          {metrics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {metrics.map(([key, value]) => (
                <span key={key} className={`rounded border px-2 py-1 font-mono text-[10px] ${variant === 'dark' ? 'border-neutral-800 bg-neutral-950 text-neutral-500' : 'border-border bg-muted/20 text-muted-foreground'}`}>
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          )}
        </div>
        <time className={`shrink-0 font-mono text-[10px] ${muted(variant)}`}>{formatRelative(event.created_at)}</time>
      </div>
    </div>
  );
}

export function TrendBars({
  points,
  variant = 'dark',
}: {
  points: Array<{ label: string; created: number; approved: number; rejected: number }>;
  variant?: Variant;
}) {
  const max = Math.max(...points.flatMap((point) => [point.created, point.approved, point.rejected]), 1);
  return (
    <div className="flex h-28 items-end gap-2">
      {points.map((point) => (
        <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-20 w-full items-end justify-center gap-1">
            <span className="w-1.5 rounded-t bg-sky-400" style={{ height: `${Math.max(5, (point.created / max) * 100)}%` }} />
            <span className="w-1.5 rounded-t bg-emerald-400" style={{ height: `${Math.max(5, (point.approved / max) * 100)}%` }} />
            <span className="w-1.5 rounded-t bg-red-400" style={{ height: `${Math.max(5, (point.rejected / max) * 100)}%` }} />
          </div>
          <span className={`font-mono text-[10px] ${muted(variant)}`}>{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DecisionStream({
  decisions,
  variant = 'dark',
}: {
  decisions: Array<{
    id: string;
    title: string;
    source_type: string;
    source_name?: string | null;
    score: number | null;
    status: 'approved' | 'rejected';
    reviewed_at: string | null;
    created_at: string;
  }>;
  variant?: Variant;
}) {
  if (decisions.length === 0) {
    return (
      <p className={`font-mono text-[11px] uppercase tracking-[0.22em] ${muted(variant)}`}>
        Awaiting first reviewer decision.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {decisions.map((decision, index) => (
        <div
          key={decision.id}
          className={`flex items-start gap-3 rounded-md border p-3 motion-safe:animate-[event-fade-in_0.6s_ease-out_both] ${
            variant === 'dark' ? 'border-neutral-800 bg-black/30' : 'border-border bg-background'
          }`}
          style={{ animationDelay: `${index * 90}ms` }}
        >
          <DecisionIcon status={decision.status} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] ${
                  decision.status === 'approved'
                    ? 'border-emerald-500/40 text-emerald-300'
                    : 'border-red-500/40 text-red-300'
                }`}
              >
                {decision.status}
              </span>
              <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${muted(variant)}`}>
                {decision.source_type}
              </span>
              {decision.source_name && (
                <span className={`truncate text-xs ${muted(variant)}`}>{decision.source_name}</span>
              )}
              {typeof decision.score === 'number' && (
                <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-neutral-950">
                  {decision.score.toFixed(1)}
                </span>
              )}
            </div>
            <p className={`mt-1.5 line-clamp-2 text-sm leading-5 ${variant === 'dark' ? 'text-neutral-300' : ''}`}>
              {decodeHtmlEntities(decision.title)}
            </p>
          </div>
          <time className={`shrink-0 font-mono text-[10px] ${muted(variant)}`}>
            {formatRelative(decision.reviewed_at ?? decision.created_at)}
          </time>
        </div>
      ))}
    </div>
  );
}

function DecisionIcon({ status }: { status: 'approved' | 'rejected' }) {
  if (status === 'approved') {
    return (
      <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border border-emerald-500/60 bg-emerald-500/20 text-emerald-300">
        <svg viewBox="0 0 20 20" fill="none" className="size-3" aria-hidden="true">
          <path d="M5 10.5l3 3 7-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border border-red-500/60 bg-red-500/20 text-red-300">
      <svg viewBox="0 0 20 20" fill="none" className="size-3" aria-hidden="true">
        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}
