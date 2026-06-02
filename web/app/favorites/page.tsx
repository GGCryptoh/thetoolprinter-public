'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Heart, X } from 'lucide-react';
import { BackOnEscape } from '@/components/system/back-on-escape';
import { PublicFooter } from '@/components/system/public-footer';
import { useFavorites, type FavoriteItem } from '@/lib/client/favorites';
import { decodeHtmlEntities } from '@/lib/text';

export default function FavoritesPage() {
  const { favorites, hydrated, remove } = useFavorites();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex !== null && activeIndex >= favorites.length) {
      queueMicrotask(() => {
        setActiveIndex(favorites.length === 0 ? null : Math.max(0, favorites.length - 1));
      });
    }
  }, [favorites.length, activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(null);
        return;
      }
      if (event.key === 'ArrowLeft' && favorites.length > 0) {
        event.preventDefault();
        setActiveIndex((idx) => ((idx ?? 0) - 1 + favorites.length) % favorites.length);
      }
      if (event.key === 'ArrowRight' && favorites.length > 0) {
        event.preventDefault();
        setActiveIndex((idx) => ((idx ?? 0) + 1) % favorites.length);
      }
      if (event.key === 'Enter') {
        const href = favorites[activeIndex]?.href;
        if (href) {
          event.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [activeIndex, favorites]);

  return (
    <main className="min-h-screen bg-[#0b0b0d] text-neutral-100">
      {activeIndex === null && <BackOnEscape />}
      <div className="border-b border-neutral-800/90 bg-[#0b0b0d]/95">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-6 px-4 py-3 sm:px-8">
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.34em] text-neutral-400 hover:text-neutral-100">
            &larr; The Tool Printer
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500">
            Your favorites · saved locally
          </span>
        </div>
      </div>

      <section className="mx-auto max-w-[1800px] px-4 py-10 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.42em] text-rose-300">
              <Heart className="size-4" fill="currentColor" />
              Favorites
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {hydrated ? favorites.length : '—'} hearted {hydrated && favorites.length === 1 ? 'article' : 'articles'}
            </h1>
          </div>
          <p className="max-w-md text-sm leading-6 text-neutral-500">
            Saved on this browser only. Clearing site data removes them.
          </p>
        </div>

        {!hydrated ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-600">Loading…</p>
        ) : favorites.length === 0 ? (
          <div className="rounded-md border border-neutral-800 bg-neutral-950/40 p-8 text-center">
            <p className="text-base text-neutral-300">No favorites yet.</p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Open any article from the front page or the older stream, then tap the heart in the upper-right.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-md border border-yellow-300/40 bg-yellow-400 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-950 transition-colors hover:bg-yellow-300"
            >
              Back to the front page
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {favorites.map((item, index) => (
              <article
                key={item.id}
                className="flex flex-col rounded-md border border-neutral-800 bg-neutral-950/40 p-4 transition-colors hover:border-neutral-600"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                    {item.source}
                  </span>
                  {item.score && (
                    <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-neutral-950">
                      {item.score}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="mt-4 block text-left text-base font-semibold leading-6 text-neutral-100 hover:text-yellow-200"
                >
                  {decodeHtmlEntities(item.title)}
                </button>
                <p className="mt-3 flex-1 text-sm leading-6 text-neutral-500">{decodeHtmlEntities(item.summary)}</p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-800/80 pt-3">
                  <time className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
                    {formatRelative(item.addedAt)}
                  </time>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {activeIndex !== null && favorites[activeIndex] && (
        <FavoriteLightbox
          favorites={favorites}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onChange={setActiveIndex}
          onRemove={(id) => {
            remove(id);
          }}
        />
      )}
      <PublicFooter />
    </main>
  );
}

function FavoriteLightbox({
  favorites,
  activeIndex,
  onClose,
  onChange,
  onRemove,
}: {
  favorites: FavoriteItem[];
  activeIndex: number;
  onClose: () => void;
  onChange: (index: number) => void;
  onRemove: (id: string) => void;
}) {
  const item = favorites[activeIndex];
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-md border border-neutral-700 bg-[#101012] shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500">
            <span>{item.kind}</span>
            <span>·</span>
            <span>{activeIndex + 1}/{favorites.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="rounded-md border border-rose-400/60 bg-rose-500/15 p-2 text-rose-300 hover:border-rose-300 hover:text-rose-200"
              aria-label="Remove from favorites"
            >
              <Heart className="size-4" fill="currentColor" />
            </button>
            <button type="button" onClick={onClose} className="rounded-md border border-neutral-800 p-2 text-neutral-400 hover:text-white" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-sm bg-yellow-400 px-2 py-1 font-mono text-[10px] font-bold text-neutral-950">
              {item.score ?? 'NOTE'}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">{item.source}</span>
          </div>
          <h2 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-4xl">{decodeHtmlEntities(item.title)}</h2>
          <p className="mt-5 text-base leading-8 text-neutral-300">{decodeHtmlEntities(item.summary)}</p>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange((activeIndex - 1 + favorites.length) % favorites.length)}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => onChange((activeIndex + 1) % favorites.length)}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
              >
                Next
                <ArrowRight className="size-4" />
              </button>
            </div>
            {item.href && (
              <a href={item.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-yellow-400 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-yellow-300">
                Open source
                <ArrowUpRight className="size-4" />
              </a>
            )}
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
            Left / right arrows to browse · Enter to open source in a new tab · Esc to close
          </p>
        </div>
      </div>
    </div>
  );
}

function formatRelative(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMin = Math.floor((Date.now() - then) / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}
