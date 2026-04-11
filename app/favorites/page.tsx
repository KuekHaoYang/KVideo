'use client';

import { Suspense } from 'react';
import {
  FavoritesPageContent,
  FavoritesPageFallback,
} from '@/components/favorites/FavoritesPageContent';

export default function Favorites() {
  return (
    <Suspense fallback={<FavoritesPageFallback />}>
      <FavoritesPageContent />
    </Suspense>
  );
}
