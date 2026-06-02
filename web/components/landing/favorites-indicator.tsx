'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useFavorites } from '@/lib/client/favorites';

export function FavoritesIndicator() {
  const { favorites, hydrated } = useFavorites();
  if (!hydrated || favorites.length === 0) return null;

  return (
    <Link
      href="/favorites"
      className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/40 bg-rose-500/10 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-rose-200 transition-colors hover:border-rose-300 hover:text-rose-100 sm:gap-2 sm:px-3"
      aria-label={`${favorites.length} favorited articles`}
    >
      <Heart className="size-3.5" fill="currentColor" aria-hidden="true" />
      {favorites.length}
    </Link>
  );
}
