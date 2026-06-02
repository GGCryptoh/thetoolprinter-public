import { cacheLife, cacheTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';
import type { NewsItem } from '@/lib/supabase/types';

export async function WorkshopSection() {
  'use cache';
  cacheLife('minutes');
  cacheTag('news', 'workshop');

  const supabase = createServiceClient();

  const { data: items } = await supabase
    .from('aitea_news_items')
    .select('*')
    .eq('status', 'approved')
    .in('source_type', ['github'])
    .order('score', { ascending: false })
    .limit(8);

  const { data: toolItems } = await supabase
    .from('aitea_news_items')
    .select('*')
    .eq('status', 'approved')
    .neq('source_type', 'github')
    .overlaps('tags', ['tools', 'framework', 'library', 'open-source', 'devtools', 'sdk'])
    .order('score', { ascending: false })
    .limit(4);

  const allItems = [...(items ?? []), ...(toolItems ?? [])] as NewsItem[];
  if (allItems.length === 0) return null;

  const seen = new Set<string>();
  const unique = allItems.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).slice(0, 8);

  return (
    <section id="workshop">
      <SectionHeader label="The Workshop" subtitle="Tools, repos, frameworks" count={unique.length} />
      <div className="grid gap-2 sm:grid-cols-2">
        {unique.map((item) => {
          const meta = item.raw_metadata as Record<string, unknown> | null;
          const stars = meta?.stars as number | undefined;
          const lang = meta?.language as string | undefined;
          const starsToday = meta?.stars_today as number | undefined;

          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 hover:border-neutral-600 transition-all"
            >
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-9 h-9 rounded-lg bg-neutral-800 shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-100 group-hover:text-white font-medium truncate">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {lang && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {lang}
                    </span>
                  )}
                  {stars && (
                    <span className="text-[11px] text-neutral-400">
                      {stars.toLocaleString()} stars
                    </span>
                  )}
                  {starsToday && starsToday > 0 && (
                    <span className="text-[11px] text-neutral-400">
                      +{starsToday} today
                    </span>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
