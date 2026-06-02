import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';
import type { NewsItem } from '@/lib/supabase/types';

export async function SignalsSection() {
  const supabase = createServiceClient();

  const { data: items } = await supabase
    .from('aitea_news_items')
    .select('*')
    .eq('status', 'approved')
    .eq('section', 'signals')
    .order('score', { ascending: false })
    .limit(20);

  if (!items || items.length === 0) return null;

  return (
    <section>
      <SectionHeader label="Signals" />
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl divide-y divide-neutral-800/50">
        {(items as NewsItem[]).map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between p-3 hover:bg-neutral-800/30 transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg font-light text-neutral-400 w-6 text-center shrink-0">
                {item.score}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-neutral-200 group-hover:text-white truncate">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-neutral-400 uppercase">{item.source_type}</span>
                  {item.source_name && (
                    <span className="text-[10px] text-neutral-400">{item.source_name}</span>
                  )}
                </div>
              </div>
            </div>
            <svg
              className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        ))}
      </div>
    </section>
  );
}
