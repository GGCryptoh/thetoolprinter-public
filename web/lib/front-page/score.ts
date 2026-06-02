import type { NewsItem } from '@/lib/supabase/types';

const DIMENSION_WEIGHTS: Record<string, number> = {
  relevance: 18,
  recency: 14,
  novelty: 12,
  evidence: 12,
  governanceFit: 12,
  operatorUsefulness: 10,
  sourceQuality: 8,
  clarity: 6,
  distinctiveness: 5,
  riskAwareness: 3,
};

export function computeWeightedScore(
  breakdown: NewsItem['score_breakdown'] | null | undefined,
): number | null {
  if (!breakdown) return null;
  let sum = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    const value = (breakdown as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      sum += value * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight === 0) return null;
  return sum / totalWeight;
}

export function getDisplayScore(item: Pick<NewsItem, 'score' | 'score_breakdown'>): number | null {
  const weighted = computeWeightedScore(item.score_breakdown);
  if (weighted !== null) return weighted;
  return typeof item.score === 'number' ? item.score : null;
}
