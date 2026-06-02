'use client';

import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type GateMode = 'human' | 'hybrid' | 'automatic';

type PublishingGateControlsProps = {
  defaults: {
    publishingGateMode: GateMode;
    autoApproveThreshold: number;
    autoRejectThreshold: number;
    maxAutoApprovedPerRun: number;
  };
  recentScores: number[];
  windowDays: number;
};

type Outcome = 'publish' | 'review' | 'reject';

function classify(score: number, mode: GateMode, approve: number, reject: number): Outcome {
  // Auto-reject applies in every mode (including human); only auto-publish is
  // gated to hybrid/automatic.
  if (score <= reject) return 'reject';
  if (mode === 'human') return 'review';
  if (score >= approve) return 'publish';
  return 'review';
}

export function PublishingGateControls({ defaults, recentScores, windowDays }: PublishingGateControlsProps) {
  const [mode, setMode] = useState<GateMode>(defaults.publishingGateMode);
  const [approve, setApprove] = useState(defaults.autoApproveThreshold);
  const [reject, setReject] = useState(defaults.autoRejectThreshold);

  const stats = useMemo(() => {
    const tally = { publish: 0, review: 0, reject: 0 };
    for (const score of recentScores) tally[classify(score, mode, approve, reject)] += 1;
    const maxScore = recentScores.length ? Math.max(...recentScores) : null;
    return { ...tally, maxScore };
  }, [recentScores, mode, approve, reject]);

  const invalidBand = reject >= approve;

  return (
    <div className="rounded-md border p-4">
      <div className="mb-4 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 text-yellow-500" />
        <div>
          <h3 className="text-sm font-semibold">Publishing Gate</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Controls when scored items become approved automatically. Scores are the 0–10 weighted
            output of the Quality Manager.
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
            <li><strong>Human</strong> — items ≤ Auto-reject are still dropped; everything else waits for manual approval. Nothing auto-publishes.</li>
            <li><strong>Hybrid</strong> — items scoring ≥ Auto-approve publish (up to the per-run cap); items ≤ Auto-reject are dropped; the band between waits for review.</li>
            <li><strong>Automatic</strong> — same bands as Hybrid, but the per-run cap is ignored so every item ≥ Auto-approve publishes in one run.</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="publishingGateMode">Gate mode</Label>
          <select
            id="publishingGateMode"
            name="publishingGateMode"
            value={mode}
            onChange={(event) => setMode(event.target.value as GateMode)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="human">Human</option>
            <option value="hybrid">Hybrid</option>
            <option value="automatic">Automatic</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxAutoApprovedPerRun">Max auto-approved / run</Label>
          <Input
            id="maxAutoApprovedPerRun"
            name="maxAutoApprovedPerRun"
            type="number"
            min={0}
            max={50}
            defaultValue={defaults.maxAutoApprovedPerRun}
          />
          <p className="text-[11px] leading-4 text-muted-foreground">
            {mode === 'automatic' ? 'Ignored in Automatic mode.' : 'Caps how many items one run can push live.'}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-5 rounded-md border bg-muted/20 p-4">
        <ThresholdSlider
          id="autoApproveThreshold"
          name="autoApproveThreshold"
          label="Auto-publish at ≥"
          value={approve}
          tone="emerald"
          disabled={mode === 'human'}
          onChange={(next) => {
            setApprove(next);
            if (reject >= next) setReject(Math.max(0, Math.round((next - 0.1) * 10) / 10));
          }}
        />
        <ThresholdSlider
          id="autoRejectThreshold"
          name="autoRejectThreshold"
          label="Auto-reject at ≤"
          value={reject}
          tone="rose"
          disabled={false}
          onChange={(next) => {
            setReject(next);
            if (next >= approve) setApprove(Math.min(10, Math.round((next + 0.1) * 10) / 10));
          }}
        />
        <p className="text-[11px] leading-4 text-muted-foreground">
          ≥ {approve.toFixed(1)} publishes · {reject.toFixed(1)}–{approve.toFixed(1)} awaits review · ≤ {reject.toFixed(1)} rejected
        </p>
        {invalidBand && (
          <p className="text-[11px] leading-4 text-destructive">
            Auto-reject must be below auto-publish, or nothing can wait for review.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Preview — last {windowDays} days
          </h4>
          <span className="text-[11px] text-muted-foreground">{recentScores.length} scored</span>
        </div>
        {recentScores.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No items have been scored in this window yet, so there is nothing to preview.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <PreviewStat label={`Would publish (${windowDays}d)`} value={stats.publish} tone="emerald" />
              <PreviewStat label={`Await review (${windowDays}d)`} value={stats.review} tone="amber" />
              <PreviewStat label={`Would reject (${windowDays}d)`} value={stats.reject} tone="rose" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
              <PreviewStat label="Publish / day" value={(stats.publish / windowDays).toFixed(1)} tone="emerald" />
              <PreviewStat label="Review / day" value={(stats.review / windowDays).toFixed(1)} tone="amber" />
              <PreviewStat label="Reject / day" value={(stats.reject / windowDays).toFixed(1)} tone="rose" />
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              Scored ~<strong>{(recentScores.length / windowDays).toFixed(1)}</strong>/day
              {' '}(<strong>{recentScores.length}</strong> over {windowDays} days). At the current
              gate, ~<strong>{Math.round((stats.publish / windowDays) * 7)}</strong> would publish
              per 7 days.
            </p>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              Highest score in window: <strong>{stats.maxScore?.toFixed(2)}</strong>.{' '}
              {mode === 'human'
                ? 'In Human mode items still auto-reject below the floor; the rest wait for manual approval (nothing auto-publishes).'
                : stats.publish === 0 && stats.maxScore !== null
                  ? `Nothing clears ≥ ${approve.toFixed(1)}. Lower auto-publish to ≤ ${stats.maxScore.toFixed(1)} to publish the top item.`
                  : 'These are the items already scored — re-running scoring will refresh the pool.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ThresholdSlider({
  id,
  name,
  label,
  value,
  tone,
  disabled,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: number;
  tone: 'emerald' | 'rose';
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const accent = tone === 'emerald' ? 'accent-emerald-500' : 'accent-rose-500';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs">{label}</Label>
        <span className="font-mono text-sm font-semibold">{value.toFixed(1)}</span>
      </div>
      {/* Hidden input always submits the value, even when the range is disabled. */}
      <input type="hidden" name={name} value={value} />
      <input
        id={id}
        type="range"
        min={0}
        max={10}
        step={0.1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-2 w-full cursor-pointer rounded-full ${accent} disabled:cursor-not-allowed disabled:opacity-50`}
      />
    </div>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'emerald' | 'amber' | 'rose';
}) {
  const color =
    tone === 'emerald' ? 'text-emerald-500' : tone === 'amber' ? 'text-amber-500' : 'text-rose-500';
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{label}</div>
    </div>
  );
}
