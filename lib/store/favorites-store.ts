/**
 * Favorites Store - Manages user's favorite videos
 * Uses Zustand with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FavoriteItem } from '@/lib/types';
import { profiledKey } from '@/lib/utils/profile-storage';

const MAX_FAVORITES = 100;

interface FavoritesState {
    favorites: FavoriteItem[];
}

interface FavoritesActions {
    addFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => void;
    removeFavorite: (videoId: string | number, source: string) => void;
    toggleFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => boolean;
    isFavorite: (videoId: string | number, source: string) => boolean;
    clearFavorites: () => void;
    importFavorites: (favorites: FavoriteItem[]) => void;
}

interface FavoritesStore extends FavoritesState, FavoritesActions { }

/**
 * Generate unique identifier for a favorite item
 */
function generateFavoriteId(
    videoId: string | number,
    source: string
): string {
    return `${source}:${videoId}`;
}

const createFavoritesStore = (name: string) =>
    create<FavoritesStore>()(
        persist(
            (set, get) => ({
                favorites: [],

                addFavorite: (item) => {
                    const favoriteId = generateFavoriteId(item.videoId, item.source);

                    set((state) => {
                        // Check if already exists
                        const exists = state.favorites.some(
                            (fav) => generateFavoriteId(fav.videoId, fav.source) === favoriteId
                        );

                        if (exists) {
                            return state;
                        }

                        const newFavorite: FavoriteItem = {
                            ...item,
                            addedAt: Date.now(),
                        };

                        let newFavorites = [newFavorite, ...state.favorites];

                        // Limit favorites size
                        if (newFavorites.length > MAX_FAVORITES) {
                            newFavorites = newFavorites.slice(0, MAX_FAVORITES);
                        }

                        return { favorites: newFavorites };
                    });
                },

                removeFavorite: (videoId, source) => {
                    const favoriteId = generateFavoriteId(videoId, source);

                    set((state) => ({
                        favorites: state.favorites.filter(
                            (fav) => generateFavoriteId(fav.videoId, fav.source) !== favoriteId
                        ),
                    }));
                },

                toggleFavorite: (item) => {
                    const state = get();
                    const favoriteId = generateFavoriteId(item.videoId, item.source);
                    const exists = state.favorites.some(
                        (fav) => generateFavoriteId(fav.videoId, fav.source) === favoriteId
                    );

                    if (exists) {
                        state.removeFavorite(item.videoId, item.source);
                        return false;
                    } else {
                        state.addFavorite(item);
                        return true;
                    }
                },

                isFavorite: (videoId, source) => {
                    const state = get();
                    const favoriteId = generateFavoriteId(videoId, source);
                    return state.favorites.some(
                        (fav) => generateFavoriteId(fav.videoId, fav.source) === favoriteId
                    );
                },

                clearFavorites: () => {
                    set({ favorites: [] });
                },

                importFavorites: (favorites) => {
                    set({ favorites });
                },
            }),
            {
                name,
            }
        )
    );

export const useFavoritesStore = createFavoritesStore(profiledKey('kvideo-favorites-store'));
export const usePremiumFavoritesStore = createFavoritesStore(profiledKey('kvideo-premium-favorites-store'));

/**
 * Helper hook to get the appropriate favorites store
 */
export function useFavorites(isPremium = false) {
    const normalStore = useFavoritesStore();
    const premiumStore = usePremiumFavoritesStore();
    return isPremium ? premiumStore : normalStore;
}
