import { connection } from 'next/server';
import { Activity, BarChart3, Coins, Gauge, PiggyBank, ReceiptText, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createServiceClient } from '@/lib/supabase/server';
import {
  estimateModelCost,
  estimateScoringBatchUsage,
  estimateScrapeCost,
  hostingCostForRange,
  hostingCostMonthToDate,
} from '@/lib/financials/model-costs';

type EventRow = {
  id: string;
  workflow_run_id: string | null;
  step: string;
  level: string;
  message: string;
  metrics: Record<string, unknown> | null;
  created_at: string;
};

type RunRow = {
  id: string;
  workflow_run_id: string | null;
  status: string;
  items_fetched: number | null;
  items_scored: number | null;
  started_at: string;
  completed_at: string | null;
};

type CostRow = {
  id: string;
  date: string;
  runId: string | null;
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  items: number;
  source: 'actual' | 'estimated';
};

export default async function FinancialsPage() {
  await connection();
  const supabase = createServiceClient();
  const now = new Date();
  const thirtyDaysAgo = addDays(now, -30).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [eventsRes, runsRes, scoredCountRes] = await Promise.all([
    supabase
      .from('aitea_ingest_events')
      .select('id, workflow_run_id, step, level, message, metrics, created_at')
      .gte('created_at', addDays(now, -90).toISOString())
      .order('created_at', { ascending: false })
      .limit(1_500),
    supabase
      .from('aitea_workflow_runs')
      .select('id, workflow_run_id, status, items_fetched, items_scored, started_at, completed_at')
      .gte('started_at', addDays(now, -90).toISOString())
      .order('started_at', { ascending: false })
      .limit(100),
    supabase
      .from('aitea_news_items')
      .select('id', { count: 'exact', head: true })
      .not('score', 'is', null)
      .gte('scored_at', thirtyDaysAgo),
  ]);

  const events = (eventsRes.data ?? []) as EventRow[];
  const runs = (runsRes.data ?? []) as RunRow[];
  const rows = buildCostRows(events);
  const rows30 = rows.filter((row) => row.date >= thirtyDaysAgo);
  const monthRows = rows.filter((row) => row.date >= monthStart);
  const actualRows = rows30.filter((row) => row.source === 'actual');
  const daily = buildDaily(rows30, now);
  const byStep = buildByStep(rows30);
  const byModel = buildByModel(rows30);
  const modelMonthCost = sum(monthRows, 'cost');
  const modelCost30 = sum(rows30, 'cost');
  const scrapeItems30 = estimateScrapedItems(events.filter((event) => event.created_at >= thirtyDaysAgo), runs.filter((run) => run.started_at >= thirtyDaysAgo));
  const scrapeItemsMonth = estimateScrapedItems(events.filter((event) => event.created_at >= monthStart), runs.filter((run) => run.started_at >= monthStart));
  const scrapeCost30 = estimateScrapeCost(scrapeItems30);
  const scrapeMonthCost = estimateScrapeCost(scrapeItemsMonth);
  const hostingCost30 = hostingCostForRange(addDays(now, -29), now);
  const hostingMonthCost = hostingCostMonthToDate(now);
  const monthCost = modelMonthCost + scrapeMonthCost + hostingMonthCost;
  const cost30 = modelCost30 + scrapeCost30 + hostingCost30;
  const tokens30 = sum(rows30, 'totalTokens');
  const input30 = sum(rows30, 'inputTokens');
  const output30 = sum(rows30, 'outputTokens');
  const scored30 = scoredCountRes.count ?? sum(rows30, 'items');
  const avgRunCost = runs.length ? cost30 / Math.max(1, runs.filter((run) => run.started_at >= thirtyDaysAgo).length) : 0;
  const costPerScored = scored30 ? cost30 / scored30 : 0;
  const projectedMonth = projectMonth(monthCost, now);
  const maxDaily = Math.max(...daily.map((day) => day.cost), 0.001);
  const maxStep = Math.max(...byStep.map((step) => step.cost), 0.001);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financials</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Token usage, estimated model spend, cost per scored item, and monthly run-rate for the
            intelligence loop. Older activity is backfilled from workflow event word counts until
            actual provider usage exists.
          </p>
        </div>
        <Badge variant={actualRows.length ? 'default' : 'secondary'} className="gap-2">
          <span className={actualRows.length ? 'size-2 rounded-full bg-emerald-400' : 'size-2 rounded-full bg-yellow-400'} />
          {actualRows.length ? 'Actual usage tracking on' : 'Estimate mode'}
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <MetricCard icon={<Coins className="size-4" />} label="Month to date" value={money(monthCost)} hint="Model + scrape + hosting" />
        <MetricCard icon={<TrendingUp className="size-4" />} label="Projected month" value={money(projectedMonth)} hint="Current run-rate" />
        <MetricCard icon={<ReceiptText className="size-4" />} label="Last 30 days" value={money(cost30)} hint={`${formatCompact(tokens30)} tokens`} />
        <MetricCard icon={<Gauge className="size-4" />} label="Cost / scored" value={money(costPerScored, 4)} hint={`${scored30} scored in 30d`} />
        <MetricCard icon={<PiggyBank className="size-4" />} label="Avg / run" value={money(avgRunCost, 4)} hint={`${runs.filter((run) => run.started_at >= thirtyDaysAgo).length} runs in 30d`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CostComponentCard
          label="Model cost"
          monthValue={modelMonthCost}
          periodValue={modelCost30}
          detail={`${formatCompact(tokens30)} tokens in 30d`}
        />
        <CostComponentCard
          label="Scrape cost"
          monthValue={scrapeMonthCost}
          periodValue={scrapeCost30}
          detail={`${formatCompact(scrapeItems30)} scraped candidates in 30d at $1/1k`}
        />
        <CostComponentCard
          label="Hosting"
          monthValue={hostingMonthCost}
          periodValue={hostingCost30}
          detail="$12/month allocated by calendar day"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5" />
              Daily Model Cost Curve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-end gap-1 rounded-lg border bg-muted/20 p-4">
              {daily.map((day) => (
                <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-48 w-full items-end">
                    <div
                      className="w-full rounded-t bg-yellow-400/80 transition-all motion-safe:animate-pulse"
                      style={{ height: `${Math.max(3, (day.cost / maxDaily) * 100)}%` }}
                      title={`${day.label}: ${money(day.cost)} · ${formatCompact(day.tokens)} tokens`}
                    />
                  </div>
                  <span className="hidden text-[10px] text-muted-foreground md:block">{day.shortLabel}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
              <div>Input tokens: <span className="font-mono text-foreground">{formatCompact(input30)}</span></div>
              <div>Output tokens: <span className="font-mono text-foreground">{formatCompact(output30)}</span></div>
              <div>Actual coverage: <span className="font-mono text-foreground">{coverage(rows30)}%</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              Model Spend by Step
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {byStep.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scoring events have been recorded yet.</p>
            ) : (
              byStep.map((step) => (
                <div key={step.step} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{step.step}</span>
                    <span className="font-mono">{money(step.cost)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-emerald-400"
                      style={{ width: `${Math.max(4, (step.cost / maxStep) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCompact(step.tokens)} tokens · {step.actual} actual / {step.estimated} estimated rows
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Model Ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byModel.map((model) => (
              <div key={model.model} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold">{model.model}</p>
                    <p className="mt-1 text-xs text-muted-foreground">$3/M input, $15/M output estimate</p>
                  </div>
                  <Badge variant="secondary">{money(model.cost)}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <span>Input <b className="font-mono text-foreground">{formatCompact(model.inputTokens)}</b></span>
                  <span>Output <b className="font-mono text-foreground">{formatCompact(model.outputTokens)}</b></span>
                  <span>Total <b className="font-mono text-foreground">{formatCompact(model.totalTokens)}</b></span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Cost Events</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Basis</th>
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3 text-right">Tokens</th>
                  <th className="py-2 pr-3 text-right">Items</th>
                  <th className="py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 14).map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 text-muted-foreground">{formatDate(row.date)}</td>
                    <td className="py-3 pr-3">
                      <Badge variant={row.source === 'actual' ? 'default' : 'secondary'}>{row.source}</Badge>
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs">{row.model}</td>
                    <td className="py-3 pr-3 text-right font-mono">{formatCompact(row.totalTokens)}</td>
                    <td className="py-3 pr-3 text-right font-mono">{row.items}</td>
                    <td className="py-3 text-right font-mono">{money(row.cost, 5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retroactive Accounting Note</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          Future scoring batches record actual token usage from the AI SDK. Historical rows before
          that instrumentation did not store provider token counts, so this page estimates them from
          the existing score batch events: captured word count, batch size, and the configured scoring
          model. Scrape cost is estimated at $1 per 1,000 scraped candidates and rounded up to cents.
          Hosting is allocated from a flat $12 monthly cost by calendar day.
        </CardContent>
      </Card>
    </div>
  );
}

function buildCostRows(events: EventRow[]): CostRow[] {
  const actualKeys = new Set(
    events
      .filter((event) => event.step === 'score:usage')
      .map((event) => `${event.workflow_run_id ?? 'none'}:${Number(event.metrics?.batch ?? 0)}`)
  );

  return events
    .flatMap((event): CostRow[] => {
      const metrics = event.metrics ?? {};
      const batch = Number(metrics.batch ?? 0);
      const runId = event.workflow_run_id ?? null;

      if (event.step === 'score:usage') {
        const cost = estimateModelCost(String(metrics.model ?? 'anthropic/claude-sonnet-4.5'), {
          inputTokens: Number(metrics.inputTokens ?? 0),
          outputTokens: Number(metrics.outputTokens ?? 0),
          totalTokens: Number(metrics.totalTokens ?? 0),
        });
        return [{
          id: event.id,
          date: event.created_at,
          runId,
          step: event.step,
          model: cost.model,
          inputTokens: cost.inputTokens,
          outputTokens: cost.outputTokens,
          totalTokens: cost.totalTokens,
          cost: Number(metrics.estimatedCostUsd ?? cost.estimatedCostUsd),
          items: Number(metrics.batchSize ?? 0),
          source: 'actual',
        }];
      }

      if (event.step === 'score:batch' && !actualKeys.has(`${runId ?? 'none'}:${batch}`)) {
        const usage = estimateScoringBatchUsage(Number(metrics.words ?? 0), Number(metrics.batchSize ?? 0));
        const cost = estimateModelCost('anthropic/claude-sonnet-4.5', usage);
        return [{
          id: event.id,
          date: event.created_at,
          runId,
          step: event.step,
          model: cost.model,
          inputTokens: cost.inputTokens,
          outputTokens: cost.outputTokens,
          totalTokens: cost.totalTokens,
          cost: cost.estimatedCostUsd,
          items: Number(metrics.batchSize ?? 0),
          source: 'estimated',
        }];
      }

      return [];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function estimateScrapedItems(events: EventRow[], runs: RunRow[]): number {
  let candidates = 0;

  for (const event of events) {
    if (!event.step.startsWith('fetch-') || event.step === 'fetch-og-images') continue;
    const metrics = event.metrics ?? {};
    candidates += Number(metrics.candidates ?? 0);
  }

  if (candidates > 0) return candidates;
  return runs.reduce((total, run) => total + Number(run.items_fetched ?? 0), 0);
}

function buildDaily(rows: CostRow[], now: Date) {
  const map = new Map<string, { cost: number; tokens: number }>();
  for (let i = 29; i >= 0; i--) {
    const date = isoDay(addDays(now, -i));
    map.set(date, { cost: 0, tokens: 0 });
  }
  for (const row of rows) {
    const date = isoDay(new Date(row.date));
    const existing = map.get(date);
    if (existing) {
      existing.cost += row.cost;
      existing.tokens += row.totalTokens;
    }
  }
  return Array.from(map.entries()).map(([date, value]) => ({
    date,
    label: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    shortLabel: new Date(`${date}T00:00:00`).getDate().toString(),
    ...value,
  }));
}

function buildByStep(rows: CostRow[]) {
  const map = new Map<string, { cost: number; tokens: number; actual: number; estimated: number }>();
  for (const row of rows) {
    const key = row.step === 'score:usage' ? 'Quality Manager scoring' : 'Historical scoring estimate';
    const existing = map.get(key) ?? { cost: 0, tokens: 0, actual: 0, estimated: 0 };
    existing.cost += row.cost;
    existing.tokens += row.totalTokens;
    existing[row.source] += 1;
    map.set(key, existing);
  }
  return Array.from(map.entries())
    .map(([step, value]) => ({ step, ...value }))
    .sort((a, b) => b.cost - a.cost);
}

function buildByModel(rows: CostRow[]) {
  const map = new Map<string, { cost: number; inputTokens: number; outputTokens: number; totalTokens: number }>();
  for (const row of rows) {
    const existing = map.get(row.model) ?? { cost: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    existing.cost += row.cost;
    existing.inputTokens += row.inputTokens;
    existing.outputTokens += row.outputTokens;
    existing.totalTokens += row.totalTokens;
    map.set(row.model, existing);
  }
  return Array.from(map.entries()).map(([model, value]) => ({ model, ...value }));
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function CostComponentCard({
  label,
  monthValue,
  periodValue,
  detail,
}: {
  label: string;
  monthValue: number;
  periodValue: number;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-3xl font-bold">{money(monthValue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">month to date</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold">{money(periodValue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">last 30d</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sum<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function money(value: number, digits = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function projectMonth(monthCost: number, now: Date) {
  const day = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return (monthCost / day) * daysInMonth;
}

function coverage(rows: CostRow[]) {
  if (rows.length === 0) return 0;
  const actual = rows.filter((row) => row.source === 'actual').length;
  return Math.round((actual / rows.length) * 100);
}
