import type { ItemStatus, Section } from '@/lib/supabase/types';

export interface Thresholds {
  trendingMin: number;
  signalsMin: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  trendingMin: 8,
  signalsMin: 5,
};

export interface RouteResult {
  section: Section | null;
  status: ItemStatus;
}

export function routeByScore(
  score: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): RouteResult {
  if (score >= thresholds.trendingMin) {
    return { section: 'trending', status: 'approved' };
  }
  if (score >= thresholds.signalsMin) {
    return { section: 'signals', status: 'pending' };
  }
  return { section: null, status: 'rejected' };
}
