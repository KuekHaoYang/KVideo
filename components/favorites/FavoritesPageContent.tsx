'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { FavoritesPageHeader } from '@/components/favorites/FavoritesPageHeader';
import { FavoritesGrid } from '@/components/favorites/FavoritesGrid';
import { FavoritesSidebar } from '@/components/favorites/FavoritesSidebar';
import { WatchHistorySidebar } from '@/components/history/WatchHistorySidebar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useFavorites } from '@/lib/store/favorites-store';

interface FavoritesPageContentProps {
  isPremium?: boolean;
}

export function FavoritesPageContent({
  isPremium = false,
}: FavoritesPageContentProps) {
  const router = useRouter();
  const { favorites, clearFavorites } = useFavorites(isPremium);
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const sortedFavorites = useMemo(() => {
    if (sortBy === 'title') {
      return [...favorites].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    }

    return favorites;
  }, [favorites, sortBy]);

  return (
    <div
      className={
        isPremium
          ? 'min-h-screen bg-black'
          : 'min-h-screen bg-[var(--bg-color)] bg-[image:var(--bg-image)] bg-fixed'
      }
    >
      <Navbar
        onReset={() => router.push(isPremium ? '/premium' : '/')}
        isPremiumMode={isPremium}
      />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <FavoritesPageHeader
          count={favorites.length}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onClearAll={() => setIsClearDialogOpen(true)}
        />

        <FavoritesGrid favorites={sortedFavorites} isPremium={isPremium} />
      </main>

      <FavoritesSidebar isPremium={isPremium} />
      <WatchHistorySidebar isPremium={isPremium} />

      <ConfirmDialog
        isOpen={isClearDialogOpen}
        title="清空收藏"
        message="确定要清空所有收藏吗？此操作不可撤销。"
        confirmText="清空"
        cancelText="取消"
        onConfirm={() => {
          clearFavorites();
          setIsClearDialogOpen(false);
        }}
        onCancel={() => setIsClearDialogOpen(false)}
        dangerous
      />
    </div>
  );
}

interface FavoritesPageFallbackProps {
  isPremium?: boolean;
}

export function FavoritesPageFallback({
  isPremium = false,
}: FavoritesPageFallbackProps) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center${
        isPremium ? ' bg-black' : ''
      }`}
    >
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--accent-color)] border-t-transparent" />
    </div>
  );
}
