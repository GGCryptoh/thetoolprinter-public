import { describe, it, expect } from 'vitest';
import { routeByScore, DEFAULT_THRESHOLDS } from '@/lib/scoring/threshold';

describe('routeByScore', () => {
  it('auto-approves score 10 to trending', () => {
    const result = routeByScore(10);
    expect(result).toEqual({ section: 'trending', status: 'approved' });
  });

  it('auto-approves score 8 to trending', () => {
    const result = routeByScore(8);
    expect(result).toEqual({ section: 'trending', status: 'approved' });
  });

  it('routes score 7 to signals as pending', () => {
    const result = routeByScore(7);
    expect(result).toEqual({ section: 'signals', status: 'pending' });
  });

  it('routes score 5 to signals as pending', () => {
    const result = routeByScore(5);
    expect(result).toEqual({ section: 'signals', status: 'pending' });
  });

  it('auto-rejects score 4', () => {
    const result = routeByScore(4);
    expect(result).toEqual({ section: null, status: 'rejected' });
  });

  it('auto-rejects score 0', () => {
    const result = routeByScore(0);
    expect(result).toEqual({ section: null, status: 'rejected' });
  });

  it('accepts custom thresholds', () => {
    const result = routeByScore(6, { trendingMin: 6, signalsMin: 3 });
    expect(result).toEqual({ section: 'trending', status: 'approved' });
  });

  it('exports default thresholds', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ trendingMin: 8, signalsMin: 5 });
  });
});
