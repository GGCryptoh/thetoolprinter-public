import { cacheLife, cacheTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';
import { ScorePill } from './score-pill';
import type { NewsItem } from '@/lib/supabase/types';

export async function BrewSection() {
  'use cache';
  cacheLife('minutes');
  cacheTag('news', 'brew');

  const supabase = createServiceClient();

  const { data: items } = await supabase
    .from('aitea_news_items')
    .select('*')
    .eq('status', 'approved')
    .gte('score', 9)
    .order('created_at', { ascending: false })
    .limit(4);

  if (!items || items.length === 0) return null;

  const hero = items[0] as NewsItem;
  const rest = items.slice(1) as NewsItem[];

  return (
    <section id="brew">
      <SectionHeader label="The Brew" subtitle="The stories everyone's talking about" count={items.length} />
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Hero story — takes 3 columns */}
        <a
          href={hero.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group lg:col-span-3 bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden hover:border-neutral-600 transition-all flex flex-col"
        >
          {hero.image_url && (
            <div className="relative w-full h-48 overflow-hidden">
              <img
                src={hero.image_url}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/90 via-neutral-900/20 to-transparent" />
            </div>
          )}
          <div className="p-6 flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ScorePill score={hero.score} />
                <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {hero.source_type}
                </span>
                {hero.source_name && (
                  <span className="text-[11px] text-neutral-400">{hero.source_name}</span>
                )}
              </div>
              <h3 className="text-xl font-light text-white leading-snug group-hover:text-neutral-100 mb-3">
                {hero.title}
              </h3>
              {hero.summary && (
                <p className="text-sm text-neutral-300 leading-relaxed line-clamp-3">{hero.summary}</p>
              )}
            </div>
            {hero.score_breakdown && (
              <div className="flex gap-4 text-[11px] text-neutral-400 mt-4 pt-4 border-t border-neutral-800/60">
                <span>Novelty {Number(hero.score_breakdown.novelty ?? 0)}</span>
                <span>Impact {Number(hero.score_breakdown.impact ?? 0)}</span>
                <span>Relevance {Number(hero.score_breakdown.relevance ?? 0)}</span>
              </div>
            )}
          </div>
        </a>

        {/* Secondary stories — take 2 columns */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {rest.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex-1 bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden hover:border-neutral-600 transition-all flex flex-row"
            >
              {item.image_url && (
                <div className="relative w-24 shrink-0 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-4 flex flex-col justify-between flex-1 min-w-0">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ScorePill score={item.score} />
                    <span className="text-[11px] text-neutral-400">{item.source_name ?? item.source_type}</span>
                  </div>
                  <p className="text-[15px] font-medium text-white leading-snug group-hover:text-neutral-100 line-clamp-2">
                    {item.title}
                  </p>
                </div>
                {item.summary && (
                  <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{item.summary}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
