import { cacheLife, cacheTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { SectionHeader } from './section-header';

export async function PeopleSection() {
  'use cache';
  cacheLife('hours');
  cacheTag('people');

  const supabase = createServiceClient();

  const { data: people } = await supabase
    .from('aitea_people')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (!people || people.length === 0) return null;

  return (
    <section id="people">
      <SectionHeader label="People to Follow" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {people.map((person) => (
          <a
            key={person.id}
            href={person.url ?? `https://x.com/${person.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-all"
          >
            <div className="flex items-start gap-3">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={person.name}
                  className="w-10 h-10 rounded-full bg-neutral-800"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-sm text-neutral-400">
                  {person.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{person.name}</p>
                <p className="text-[10px] text-neutral-400">@{person.handle}</p>
              </div>
            </div>
            {person.description && (
              <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{person.description}</p>
            )}
            {person.tags && person.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {person.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-[10px] rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
