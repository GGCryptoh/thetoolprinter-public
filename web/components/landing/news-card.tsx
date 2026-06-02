'use client';

import type { NewsItem } from '@/lib/supabase/types';
import { ScorePill } from './score-pill';
import { useLastVisit } from './new-items-provider';
import { isNew } from './new-indicator';

export function NewsCard({ item, compact }: { item: NewsItem; compact?: boolean }) {
  const lastVisit = useLastVisit();
  const itemIsNew = isNew(item.created_at, lastVisit);

  const newBorder = itemIsNew ? 'border-l-2 border-l-neutral-400' : '';

  if (compact) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex items-center gap-3 px-4 py-3 hover:bg-neutral-800/40 transition-colors ${newBorder}`}
      >
        <ScorePill score={item.score} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-100 group-hover:text-white truncate">
            {item.title}
          </p>
          <span className="text-[11px] text-neutral-400">
            {item.source_name ?? item.source_type}
          </span>
        </div>
        <svg
          className="w-4 h-4 text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>
      </a>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-5 hover:border-neutral-600 hover:bg-neutral-800/40 transition-all ${newBorder}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2.5 min-w-0">
          <p className="text-[15px] font-medium text-white leading-snug group-hover:text-neutral-100 line-clamp-2">
            {item.title}
          </p>
          {item.summary && (
            <p className="text-sm text-neutral-300 line-clamp-2 leading-relaxed">{item.summary}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
              {item.source_type}
            </span>
            {item.source_name && (
              <span className="text-[11px] text-neutral-400">{item.source_name}</span>
            )}
          </div>
          {item.score_breakdown && (
            <div className="flex gap-4 text-[11px] text-neutral-400">
              <span>Novelty {Number(item.score_breakdown.novelty ?? 0)}</span>
              <span>Impact {Number(item.score_breakdown.impact ?? 0)}</span>
              <span>Relevance {Number(item.score_breakdown.relevance ?? 0)}</span>
            </div>
          )}
        </div>
        <ScorePill score={item.score} />
      </div>
    </a>
  );
}
