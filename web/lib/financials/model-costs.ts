export type ModelUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type CostEstimate = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  pricingSource: string;
  pricingBasis: string;
};

export const SCRAPE_COST_PER_1000_ITEMS = 1;
export const HOSTING_COST_PER_MONTH_USD = 12;

const MODEL_RATES: Record<string, { inputPerMillion: number; outputPerMillion: number; label: string }> = {
  'anthropic/claude-sonnet-4.5': {
    inputPerMillion: 3,
    outputPerMillion: 15,
    label: 'Anthropic Claude Sonnet 4.5 list pricing',
  },
};

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5';

export function estimateModelCost(model = DEFAULT_MODEL, usage: ModelUsage): CostEstimate {
  const rates = MODEL_RATES[model] ?? MODEL_RATES[DEFAULT_MODEL];
  const inputTokens = Math.max(0, Math.round(Number(usage.inputTokens ?? 0)));
  const outputTokens = Math.max(0, Math.round(Number(usage.outputTokens ?? 0)));
  const totalTokens = Math.max(inputTokens + outputTokens, Math.round(Number(usage.totalTokens ?? 0)));
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * rates.inputPerMillion +
    (outputTokens / 1_000_000) * rates.outputPerMillion;

  return {
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    pricingSource: rates.label,
    pricingBasis: `$${rates.inputPerMillion}/M input, $${rates.outputPerMillion}/M output`,
  };
}

export function estimateScrapeCost(items: number): number {
  const rawCost = (Math.max(0, Number(items) || 0) / 1_000) * SCRAPE_COST_PER_1000_ITEMS;
  return Math.ceil(rawCost * 100) / 100;
}

export function hostingCostForRange(startDate: Date, endDate: Date): number {
  let total = 0;
  const cursor = startOfDay(startDate);
  const end = startOfDay(endDate);

  while (cursor <= end) {
    total += HOSTING_COST_PER_MONTH_USD / daysInMonth(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

export function hostingCostMonthToDate(now: Date): number {
  return hostingCostForRange(new Date(now.getFullYear(), now.getMonth(), 1), now);
}

export function hostingCostPerDay(now: Date): number {
  return HOSTING_COST_PER_MONTH_USD / daysInMonth(now);
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function estimateScoringBatchUsage(words: number, items: number): ModelUsage {
  const safeWords = Math.max(0, Number(words) || 0);
  const safeItems = Math.max(0, Number(items) || 0);
  const inputTokens = Math.round(safeWords * 1.35 + 1_100);
  const outputTokens = Math.round(Math.max(450, safeItems * 260));

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}
