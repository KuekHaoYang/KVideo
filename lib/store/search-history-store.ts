/**
 * Search History Store using Zustand
 * Manages search query history with localStorage persistence
 * Following Liquid Glass design principles
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { profiledKey } from '@/lib/utils/profile-storage';

const MAX_HISTORY_ITEMS = 20;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount?: number;
}

interface SearchHistoryStore {
  searchHistory: SearchHistoryItem[];

  // Actions
  addToSearchHistory: (query: string, resultCount?: number) => void;
  removeFromSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  getRecentSearches: (limit?: number) => SearchHistoryItem[];
}

/**
 * Normalize query for comparison (trim, lowercase)
 */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

const createSearchHistoryStore = (name: string) =>
  create<SearchHistoryStore>()(
    persist(
      (set, get) => ({
        searchHistory: [],

        addToSearchHistory: (query, resultCount) => {
          const trimmedQuery = query.trim();

          // Don't add empty queries
          if (!trimmedQuery) return;

          const normalized = normalizeQuery(trimmedQuery);
          const timestamp = Date.now();

          set((state) => {
            // Check if query already exists (case-insensitive)
            const existingIndex = state.searchHistory.findIndex(
              (item) => normalizeQuery(item.query) === normalized
            );

            let newHistory: SearchHistoryItem[];

            if (existingIndex !== -1) {
              // Update existing item and move to top
              const updatedItem: SearchHistoryItem = {
                query: trimmedQuery, // Keep original casing from new search
                timestamp,
                resultCount,
              };

              newHistory = [
                updatedItem,
                ...state.searchHistory.filter((_, index) => index !== existingIndex),
              ];
            } else {
              // Add new item at the top
              const newItem: SearchHistoryItem = {
                query: trimmedQuery,
                timestamp,
                resultCount,
              };

              newHistory = [newItem, ...state.searchHistory];
            }

            // Trim to max items
            if (newHistory.length > MAX_HISTORY_ITEMS) {
              newHistory = newHistory.slice(0, MAX_HISTORY_ITEMS);
            }

            return { searchHistory: newHistory };
          });
        },

        removeFromSearchHistory: (query) => {
          const normalized = normalizeQuery(query);

          set((state) => ({
            searchHistory: state.searchHistory.filter(
              (item) => normalizeQuery(item.query) !== normalized
            ),
          }));
        },

        clearSearchHistory: () => {
          set({ searchHistory: [] });
        },

        getRecentSearches: (limit = 10) => {
          const history = get().searchHistory;
          return history.slice(0, limit);
        },
      }),
      {
        name,
        version: 1,
      }
    )
  );

export const useSearchHistoryStore = createSearchHistoryStore(profiledKey('kvideo-search-history'));
export const usePremiumSearchHistoryStore = createSearchHistoryStore(profiledKey('kvideo-premium-search-history'));

/**
 * Helper hook to get the appropriate search history store
 */
export function useSearchHistoryStoreSelector(isPremium = false) {
  const normalStore = useSearchHistoryStore();
  const premiumStore = usePremiumSearchHistoryStore();
  return isPremium ? premiumStore : normalStore;
}
