import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';
import { NewsCard } from './news-card';
import type { NewsItem } from '@/lib/supabase/types';

export async function TrendingSection() {
  const supabase = createServiceClient();

  const { data: items } = await supabase
    .from('aitea_news_items')
    .select('*')
    .eq('status', 'approved')
    .eq('section', 'trending')
    .order('score', { ascending: false })
    .limit(8);

  if (!items || items.length === 0) return null;

  return (
    <section>
      <SectionHeader label="Trending" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(items as NewsItem[]).map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
