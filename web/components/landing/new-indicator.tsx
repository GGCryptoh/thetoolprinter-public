'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'aitea-last-visit';

function getLastVisit(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

function updateLastVisit() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, new Date().toISOString());
}

export function useNewSince() {
  const [lastVisit, setLastVisit] = useState<string | null>(null);

  useEffect(() => {
    const stored = getLastVisit();
    queueMicrotask(() => setLastVisit(stored));

    // Update timestamp after a short delay so current items are seen as "new"
    const timer = setTimeout(() => {
      updateLastVisit();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return lastVisit;
}

export function isNew(createdAt: string, lastVisit: string | null): boolean {
  if (!lastVisit) return false; // First visit — nothing is "new"
  return new Date(createdAt) > new Date(lastVisit);
}

export function NewBorder({
  createdAt,
  lastVisit,
  children,
}: {
  createdAt: string;
  lastVisit: string | null;
  children: React.ReactNode;
}) {
  const isNewItem = isNew(createdAt, lastVisit);

  return (
    <div className={isNewItem ? 'relative pl-0.5' : ''}>
      {isNewItem && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-neutral-400" />
      )}
      {children}
    </div>
  );
}
