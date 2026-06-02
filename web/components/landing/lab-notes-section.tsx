import { cacheLife, cacheTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';
import { NewsCard } from './news-card';
import type { NewsItem } from '@/lib/supabase/types';

export async function LabNotesSection() {
  'use cache';
  cacheLife('minutes');
  cacheTag('news', 'lab');

  const supabase = createServiceClient();

  const { data: items } = await supabase
    .from('aitea_news_items')
    .select('*')
    .eq('status', 'approved')
    .overlaps('tags', ['research', 'models', 'benchmark', 'paper', 'training', 'architecture', 'llm', 'AI safety', 'compute', 'policy', 'strategy'])
    .order('score', { ascending: false })
    .limit(5);

  if (!items || items.length === 0) return null;

  return (
    <section id="lab">
      <SectionHeader label="Lab Notes" subtitle="Research, model drops, benchmarks" count={items.length} />
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl divide-y divide-neutral-800/50">
        {(items as NewsItem[]).map((item) => (
          <NewsCard key={item.id} item={item} compact />
        ))}
      </div>
    </section>
  );
}
