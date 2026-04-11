/**
 * TVContext
 * Provides TV mode detection to the entire app.
 */

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useTVDetection } from '@/lib/hooks/useTVDetection';

const TVContext = createContext(false);

export function TVProvider({ children }: { children: ReactNode }) {
  const isTV = useTVDetection();

  return (
    <TVContext.Provider value={isTV}>
      {children}
    </TVContext.Provider>
  );
}

export function useIsTV(): boolean {
  return useContext(TVContext);
}
