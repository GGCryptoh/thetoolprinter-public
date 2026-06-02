import { cacheLife, cacheTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';

interface KnowledgeItem {
  name: string;
  description?: string;
  url?: string;
  tags?: string[];
}

const categoryIcons: Record<string, React.ReactNode> = {
  models: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  ),
  context: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
  memory: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  skills: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.07 1.03-5.99L2.66 7.99l6.014-.874L11.42 2l2.745 5.116 6.014.874-4.406 4.26 1.03 5.99-5.384-3.07z" />
    </svg>
  ),
};

export async function StacksSection() {
  'use cache';
  cacheLife('hours');
  cacheTag('knowledge');

  const supabase = createServiceClient();

  const { data: blocks } = await supabase
    .from('aitea_knowledge_blocks')
    .select('*')
    .order('sort_order', { ascending: true });

  if (!blocks || blocks.length === 0) return null;

  return (
    <section id="stacks">
      <SectionHeader label="The Stacks" subtitle="Reference guides and curated knowledge" count={blocks.length} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {blocks.map((block) => {
          const items = block.content_json as KnowledgeItem[];
          const icon = categoryIcons[block.category] ?? categoryIcons.models;

          return (
            <div
              key={block.id}
              className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-5 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
                  {icon}
                </div>
                <h3 className="text-sm font-medium text-neutral-100 capitalize">{block.title}</h3>
              </div>
              <div className="space-y-3">
                {items.slice(0, 5).map((item, i) => (
                  <div key={i} className="group">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                        <p className="text-sm text-neutral-200 group-hover:text-white transition-colors">{item.name}</p>
                        {item.description && (
                          <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{item.description}</p>
                        )}
                      </a>
                    ) : (
                      <>
                        <p className="text-sm text-neutral-200">{item.name}</p>
                        {item.description && (
                          <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{item.description}</p>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-neutral-400">No entries yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
