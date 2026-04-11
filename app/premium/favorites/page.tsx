'use client';

import { Suspense } from 'react';
import {
  FavoritesPageContent,
  FavoritesPageFallback,
} from '@/components/favorites/FavoritesPageContent';

export default function PremiumFavorites() {
  return (
    <Suspense fallback={<FavoritesPageFallback isPremium />}>
      <FavoritesPageContent isPremium />
    </Suspense>
  );
}
