/**
 * FavoritesList - Scrollable list of favorite items
 */

import type { FavoriteItem } from '@/lib/types';
import { FavoritesItem } from './FavoritesItem';
import { FavoritesEmptyState } from './FavoritesEmptyState';
import { keepRenderableFavorites } from '@/lib/utils/sync-records';

interface FavoritesListProps {
    favorites: FavoriteItem[];
    onRemove: (videoId: string | number, source: string) => void;
    isPremium?: boolean;
}

export function FavoritesList({ favorites, onRemove, isPremium = false }: FavoritesListProps) {
    const renderableFavorites = keepRenderableFavorites(favorites);

    if (renderableFavorites.length === 0) {
        return <FavoritesEmptyState />;
    }

    return (
        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-2 scroll-smooth">
            {renderableFavorites.map((item) => (
                <FavoritesItem
                    key={`${item.source}:${item.videoId}`}
                    item={item}
                    onRemove={() => onRemove(item.videoId, item.source)}
                    isPremium={isPremium}
                />
            ))}
        </div>
    );
}
