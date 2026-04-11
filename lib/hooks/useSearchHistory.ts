/**
 * useSearchHistory Hook
 * Manages search history dropdown state and interactions
 * Liquid Glass design system compliant
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchHistoryStoreSelector } from '@/lib/store/search-history-store';
import type { SearchHistoryItem } from '@/lib/store/search-history-store';

interface UseSearchHistoryReturn {
  searchHistory: SearchHistoryItem[];
  isDropdownOpen: boolean;
  highlightedIndex: number;
  showDropdown: () => void;
  hideDropdown: () => void;
  addSearch: (query: string, resultCount?: number) => void;
  removeSearch: (query: string) => void;
  clearAll: () => void;
  selectHistoryItem: (query: string) => void;
  navigateDropdown: (direction: 'up' | 'down') => void;
  resetHighlight: () => void;
}

export function useSearchHistory(
  onSelectHistory?: (query: string) => void,
  isPremium: boolean = false
): UseSearchHistoryReturn {
  const {
    searchHistory,
    addToSearchHistory,
    removeFromSearchHistory,
    clearSearchHistory,
    getRecentSearches,
  } = useSearchHistoryStoreSelector(isPremium);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get recent searches (limit to 10 for dropdown)
  const recentSearches = getRecentSearches(10);

  const showDropdown = useCallback(() => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    // Show dropdown even if there's no history (for consistent UX)
    setIsDropdownOpen(true);
    setHighlightedIndex(-1);
  }, []);

  const hideDropdown = useCallback(() => {
    // Delay hiding to allow click events to fire
    dropdownTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }, 150);
  }, []);

  const addSearch = useCallback(
    (query: string, resultCount?: number) => {
      addToSearchHistory(query, resultCount);
    },
    [addToSearchHistory]
  );

  const removeSearch = useCallback(
    (query: string) => {
      removeFromSearchHistory(query);
    },
    [removeFromSearchHistory]
  );

  const clearAll = useCallback(() => {
    clearSearchHistory();
    setIsDropdownOpen(false);
  }, [clearSearchHistory]);

  const selectHistoryItem = useCallback(
    (query: string) => {
      if (onSelectHistory) {
        onSelectHistory(query);
      }
      hideDropdown();
    },
    [onSelectHistory, hideDropdown]
  );

  const navigateDropdown = useCallback(
    (direction: 'up' | 'down') => {
      if (!isDropdownOpen || recentSearches.length === 0) return;

      setHighlightedIndex((prevIndex) => {
        if (direction === 'down') {
          return prevIndex < recentSearches.length - 1 ? prevIndex + 1 : 0;
        } else {
          return prevIndex > 0 ? prevIndex - 1 : recentSearches.length - 1;
        }
      });
    },
    [isDropdownOpen, recentSearches.length]
  );

  const resetHighlight = useCallback(() => {
    setHighlightedIndex(-1);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
      }
    };
  }, []);

  return {
    searchHistory: recentSearches,
    isDropdownOpen,
    highlightedIndex,
    showDropdown,
    hideDropdown,
    addSearch,
    removeSearch,
    clearAll,
    selectHistoryItem,
    navigateDropdown,
    resetHighlight,
  };
}
