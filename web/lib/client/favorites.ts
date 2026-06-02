'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'the-tool-printer-favorites';

export interface FavoriteItem {
  id: string;
  title: string;
  source: string;
  kind: string;
  score?: string;
  summary: string;
  href?: string | null;
  createdAt?: string | null;
  addedAt: string;
}

function readStored(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is FavoriteItem => {
      return entry && typeof entry === 'object' && typeof entry.id === 'string';
    });
  } catch {
    return [];
  }
}

function persist(items: FavoriteItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    // Defer the event so subscribers don't run setState while we're still
    // inside the current setFavorites updater.
    queueMicrotask(() => {
      window.dispatchEvent(new Event('the-tool-printer-favorites-changed'));
    });
  } catch {
    // ignore quota / disabled storage
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedFavorites = readStored();
    queueMicrotask(() => {
      setFavorites(storedFavorites);
      setHydrated(true);
    });

    const sync = () => setFavorites(readStored());
    window.addEventListener('storage', sync);
    window.addEventListener('the-tool-printer-favorites-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('the-tool-printer-favorites-changed', sync);
    };
  }, []);

  const toggle = (item: Omit<FavoriteItem, 'addedAt'>) => {
    setFavorites((prev) => {
      const exists = prev.some((entry) => entry.id === item.id);
      const next = exists
        ? prev.filter((entry) => entry.id !== item.id)
        : [{ ...item, addedAt: new Date().toISOString() }, ...prev];
      persist(next);
      return next;
    });
  };

  const remove = (id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      persist(next);
      return next;
    });
  };

  return { favorites, hydrated, toggle, remove };
}

export function isFavoriteId(favorites: FavoriteItem[], id: string | undefined): boolean {
  if (!id) return false;
  return favorites.some((entry) => entry.id === id);
}
