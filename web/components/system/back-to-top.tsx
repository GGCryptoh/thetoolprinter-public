'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';

export function BackToTop({ threshold = 600 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-yellow-300/40 bg-[#0b0b0d]/85 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-yellow-200 shadow-lg backdrop-blur-md transition-colors hover:border-yellow-400 hover:text-yellow-100 sm:bottom-6 sm:right-6"
    >
      <ArrowUp className="size-3.5" />
      Top
    </button>
  );
}
