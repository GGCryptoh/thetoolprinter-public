import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';
import type { NewsItem } from '@/lib/supabase/types';

export async function YouTubeSection() {
  const supabase = createServiceClient();

  const { data: items } = await supabase
    .from('aitea_news_items')
    .select('*')
    .eq('status', 'approved')
    .eq('source_type', 'youtube')
    .order('created_at', { ascending: false })
    .limit(6);

  if (!items || items.length === 0) return null;

  return (
    <section>
      <SectionHeader label="YouTube" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(items as NewsItem[]).map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700 transition-all"
          >
            {item.image_url && (
              <div className="aspect-video bg-neutral-800 relative overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                {item.score !== null && item.score >= 8 && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-neutral-800/80 text-neutral-300 border border-neutral-700 backdrop-blur-sm">
                    Worth watching
                  </span>
                )}
              </div>
            )}
            <div className="p-3 space-y-1">
              <p className="text-sm font-medium text-white line-clamp-2">{item.title}</p>
              {item.source_name && (
                <p className="text-[10px] text-neutral-400">{item.source_name}</p>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
