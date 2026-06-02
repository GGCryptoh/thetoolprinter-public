'use client';

import { createContext, useContext } from 'react';
import { useNewSince } from './new-indicator';

const NewSinceContext = createContext<string | null>(null);

export function NewItemsProvider({ children }: { children: React.ReactNode }) {
  const lastVisit = useNewSince();
  return (
    <NewSinceContext.Provider value={lastVisit}>
      {children}
    </NewSinceContext.Provider>
  );
}

export function useLastVisit() {
  return useContext(NewSinceContext);
}
