'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SectionInfo {
  id: string;
  label: string;
}

export function SectionNav({ sections }: { sections: SectionInfo[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto scrollbar-none py-2">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-wider transition-colors ${
              active === s.id
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            {s.label}
          </a>
        ))}
        <span className="w-px h-4 bg-neutral-700 mx-1 shrink-0" />
        <Link
          href="/blog"
          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 transition-colors"
        >
          Blog
        </Link>
        <span className="w-px h-4 bg-neutral-700 mx-1 shrink-0" />
        <Link
          href="/report"
          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 transition-colors"
        >
          Report
        </Link>
      </div>
    </nav>
  );
}
