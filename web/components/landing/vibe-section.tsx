import { cacheLife, cacheTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';
import { NewsCard } from './news-card';
import type { NewsItem } from '@/lib/supabase/types';

export async function VibeSection() {
  'use cache';
  cacheLife('minutes');
  cacheTag('news', 'vibe');

  const supabase = createServiceClient();

  const { data: items } = await supabase
    .from('aitea_news_items')
    .select('*')
    .eq('status', 'approved')
    .overlaps('tags', ['agents', 'prompts', 'context', 'vibe', 'workflow', 'rag', 'patterns', 'automation', 'tools', 'framework'])
    .order('score', { ascending: false })
    .limit(5);

  if (!items || items.length === 0) return null;

  return (
    <section id="vibe">
      <SectionHeader label="Vibe Engineering" subtitle="Prompts, context, agent patterns" count={items.length} />
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl divide-y divide-neutral-800/50">
        {(items as NewsItem[]).map((item) => (
          <NewsCard key={item.id} item={item} compact />
        ))}
      </div>
    </section>
  );
}
