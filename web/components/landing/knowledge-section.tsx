import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';

interface KnowledgeItem {
  name: string;
  description?: string;
  links?: string[];
  tags?: string[];
}

export async function KnowledgeSection() {
  const supabase = createServiceClient();

  const { data: blocks } = await supabase
    .from('aitea_knowledge_blocks')
    .select('*')
    .order('sort_order', { ascending: true });

  if (!blocks || blocks.length === 0) return null;

  return (
    <section>
      <SectionHeader label="Knowledge" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4"
          >
            <h3 className="text-sm font-medium text-white mb-3 capitalize">{block.title}</h3>
            <div className="space-y-2">
              {(block.content_json as KnowledgeItem[]).slice(0, 5).map((item, i) => (
                <div key={i} className="text-xs">
                  <p className="text-neutral-200">{item.name}</p>
                  {item.description && (
                    <p className="text-neutral-400 mt-0.5">{item.description}</p>
                  )}
                </div>
              ))}
              {(block.content_json as KnowledgeItem[]).length === 0 && (
                <p className="text-xs text-neutral-400">No entries yet.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
