import { cacheLife, cacheTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';
import { ScorePill } from './score-pill';
import type { NewsItem } from '@/lib/supabase/types';

export async function HotTakesSection() {
  'use cache';
  cacheLife('minutes');
  cacheTag('news', 'hot-takes');

  const supabase = createServiceClient();

  const { data: items } = await supabase
    .from('aitea_news_items')
    .select('*')
    .eq('status', 'approved')
    .eq('source_type', 'twitter')
    .order('created_at', { ascending: false })
    .limit(6);

  if (!items || items.length === 0) return null;

  return (
    <section id="hot-takes">
      <SectionHeader label="Hot Takes" subtitle="The discourse, opinions, drama" count={items.length} />
      <div className="space-y-2">
        {(items as NewsItem[]).map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 hover:border-neutral-600 transition-all"
          >
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[11px] text-neutral-300 font-medium">
                {(item.source_name ?? '@').replace('@', '').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] text-neutral-200 font-medium">
                    {item.source_name}
                  </span>
                  <ScorePill score={item.score} />
                </div>
                <p className="text-sm text-neutral-200 leading-relaxed group-hover:text-white">
                  {item.summary ?? item.title}
                </p>
                {item.raw_metadata && (item.raw_metadata as Record<string, number>).likes > 0 && (
                  <div className="flex gap-3 mt-2 text-[11px] text-neutral-400">
                    <span>{(item.raw_metadata as Record<string, number>).likes?.toLocaleString()} likes</span>
                    {(item.raw_metadata as Record<string, number>).retweets > 0 && (
                      <span>{(item.raw_metadata as Record<string, number>).retweets?.toLocaleString()} reposts</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
