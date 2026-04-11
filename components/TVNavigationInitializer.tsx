/**
 * TVNavigationInitializer
 * Adds tv-mode class to body and activates spatial navigation when TV is detected.
 */

'use client';

import { useEffect } from 'react';
import { useIsTV } from '@/lib/contexts/TVContext';
import { useSpatialNavigation } from '@/lib/hooks/useSpatialNavigation';

export function TVNavigationInitializer() {
  const isTV = useIsTV();

  useEffect(() => {
    if (isTV) {
      document.body.classList.add('tv-mode');
    } else {
      document.body.classList.remove('tv-mode');
    }
    return () => {
      document.body.classList.remove('tv-mode');
    };
  }, [isTV]);

  useSpatialNavigation(isTV);

  return null;
}
