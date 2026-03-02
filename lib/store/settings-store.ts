/**
 * Settings Store - Manages application settings and preferences
 */

import type { VideoSource, SourceSubscription } from '@/lib/types';
import { DEFAULT_SOURCES } from '@/lib/api/default-sources';
import { PREMIUM_SOURCES } from '@/lib/api/premium-sources';
import { createSubscription } from '@/lib/utils/source-import-utils';

export type LocaleOption = 'zh-CN' | 'zh-TW';

export type SortOption =
  | 'default'
  | 'relevance'
  | 'latency-asc'
  | 'date-desc'
  | 'date-asc'
  | 'rating-desc'
  | 'name-asc'
  | 'name-desc';

export type SearchDisplayMode = 'normal' | 'grouped';
export type AdFilterMode = 'off' | 'keyword' | 'heuristic' | 'aggressive';
export type ProxyMode = 'retry' | 'none' | 'always';

export interface AppSettings {
  sources: VideoSource[];
  premiumSources: VideoSource[];
  subscriptions: SourceSubscription[]; // Source subscriptions for auto-update
  sortBy: SortOption;
  searchHistory: boolean;
  watchHistory: boolean;
  // Player settings
  autoNextEpisode: boolean;
  autoSkipIntro: boolean;
  skipIntroSeconds: number;
  autoSkipOutro: boolean;
  skipOutroSeconds: number;
  showModeIndicator: boolean; // Show '直连模式'/'代理模式' badge on player
  adFilter: boolean; // Filter ad tags from m3u8 (legacy, kept for compatibility)
  adFilterMode: AdFilterMode; // 'off' | 'keyword' | 'heuristic' | 'aggressive'
  adKeywords: string[]; // Dynamically loaded ad keywords
  // Search & Display settings
  realtimeLatency: boolean; // Enable real-time latency ping updates
  searchDisplayMode: SearchDisplayMode; // 'normal' = individual cards, 'grouped' = group same-name videos
  episodeReverseOrder: boolean; // Persist episode list reverse state
  fullscreenType: 'auto' | 'native' | 'window'; // Fullscreen mode preference: 'auto' (native on desktop, window on mobile) | 'native' | 'window'
  proxyMode: ProxyMode; // Proxy behavior: 'retry' | 'none' | 'always'
  rememberScrollPosition: boolean; // Remember scroll position when navigating back or refreshing
  personalizedRecommendations: boolean; // Show personalized recommendations based on watch history
  // Danmaku settings
  danmakuEnabled: boolean; // Show danmaku overlay on video
  danmakuApiUrl: string; // Self-hosted danmaku API endpoint
  danmakuOpacity: number; // 0.1 - 1.0
  danmakuFontSize: number; // px
  danmakuDisplayArea: number; // 0.25 | 0.5 | 0.75 | 1.0
  locale: LocaleOption; // 'zh-CN' (Simplified) or 'zh-TW' (Traditional)
}

import { exportSettings, importSettings, SEARCH_HISTORY_KEY, WATCH_HISTORY_KEY } from './settings-helpers';

const SETTINGS_KEY = 'kvideo-settings';

export const getDefaultSources = (): VideoSource[] => DEFAULT_SOURCES;
export const getDefaultPremiumSources = (): VideoSource[] => PREMIUM_SOURCES;



function getEnvSubscriptions(customValue?: string): SourceSubscription[] {
  const envValue = (customValue || process.env.SUBSCRIPTION_SOURCES || process.env.NEXT_PUBLIC_SUBSCRIPTION_SOURCES || '').trim();
  if (!envValue) return [];

  // 1. Try JSON
  try {
    const raw = JSON.parse(envValue);
    if (Array.isArray(raw)) {
      return raw
        .filter((item: any) => item && typeof item.name === 'string' && typeof item.url === 'string')
        .map((item: any) => createSubscription(item.name, item.url));
    }
  } catch (e) {
    // Ignore JSON parse error, try direct URL
  }

  // 2. Try Simple URL (or comma separated)
  // Check if it looks like a URL (basic check)
  if (envValue.includes('http')) {
    const urls = envValue.split(',').map(u => u.trim()).filter(u => u.length > 0);
    return urls.map((url, index) => {
      // Basic URL validation
      if (!url.startsWith('http')) return null;

      const name = urls.length > 1
        ? `系统预设源 ${index + 1}`
        : `系统预设源`;

      return createSubscription(name, url);
    }).filter((s): s is SourceSubscription => s !== null);
  }

  return [];
}
// Debugging helper
// console.log("Environment Subscriptions:", getEnvSubscriptions());

// Shared default settings factory to avoid code duplication
function getDefaultAppSettings(): AppSettings {
  return {
    sources: getDefaultSources(),
    premiumSources: getDefaultPremiumSources(),
    subscriptions: getEnvSubscriptions(),
    sortBy: 'default',
    searchHistory: true,
    watchHistory: true,
    autoNextEpisode: true,
    autoSkipIntro: false,
    skipIntroSeconds: 0,
    autoSkipOutro: false,
    skipOutroSeconds: 0,
    showModeIndicator: false,
    adFilter: false,
    adFilterMode: 'heuristic',
    adKeywords: [],
    realtimeLatency: false,
    searchDisplayMode: 'normal',
    episodeReverseOrder: false,
    fullscreenType: 'auto',
    proxyMode: 'retry',
    rememberScrollPosition: true,
    personalizedRecommendations: true,
    danmakuEnabled: false,
    danmakuApiUrl: process.env.NEXT_PUBLIC_DANMAKU_API_URL || '',
    danmakuOpacity: 0.7,
    danmakuFontSize: 20,
    danmakuDisplayArea: 0.5,
    locale: 'zh-CN',
  };
}

export const settingsStore = {
  getSettings(): AppSettings {
    // SSR: Return defaults
    if (typeof window === 'undefined') {
      return getDefaultAppSettings();
    }

    // Client: No stored settings, return defaults
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return getDefaultAppSettings();
    }

    try {
      const parsed = JSON.parse(stored);
      // Get ENV subscriptions
      const envSubscriptions = getEnvSubscriptions();

      // Parse stored subscriptions
      const storedSubscriptions = Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [];

      // Merge: ENV subscriptions take precedence for existence, but we want to keep local state (like lastUpdated) if possible
      // However, for simplicity and ensuring "auto update" as user requested, if it's in ENV, we act as if it's a fresh/enforced source
      // actually, let's just merge them by URL.

      const mergedSubscriptions = [...storedSubscriptions];

      envSubscriptions.forEach(envSub => {
        const existingIndex = mergedSubscriptions.findIndex(s => s.url === envSub.url);
        if (existingIndex > -1) {
          // Update name if changed in ENV, but keep ID and lastUpdated from local to avoid unnecessary re-fetches or ID shifts if dependent
          // BUT, if the user explicitly wants "ENV input... automatically update", maybe they mean the content updates.
          // Let's just ensure it exists.
          mergedSubscriptions[existingIndex] = {
            ...mergedSubscriptions[existingIndex],
            name: envSub.name, // Allow renaming via ENV
            autoRefresh: true // Enforce autoRefresh for ENV sources
          };
        } else {
          mergedSubscriptions.push(envSub);
        }
      });

      // Filter out invalid sources (missing baseUrl etc)
      const validSources = (Array.isArray(parsed.sources) ? parsed.sources : getDefaultSources())
        .filter((s: any) => s && s.id && s.name && s.baseUrl);

      const validPremiumSources = (Array.isArray(parsed.premiumSources) ? parsed.premiumSources : getDefaultPremiumSources())
        .filter((s: any) => s && s.id && s.name && s.baseUrl);

      // Validate that parsed data has all required properties
      return {
        sources: validSources,
        premiumSources: validPremiumSources,
        subscriptions: mergedSubscriptions.filter((s: any) => s && s.id && s.name && s.url),
        sortBy: parsed.sortBy || 'default',
        searchHistory: parsed.searchHistory !== undefined ? parsed.searchHistory : true,
        watchHistory: parsed.watchHistory !== undefined ? parsed.watchHistory : true,
        autoNextEpisode: parsed.autoNextEpisode !== undefined ? parsed.autoNextEpisode : true,
        autoSkipIntro: parsed.autoSkipIntro !== undefined ? parsed.autoSkipIntro : false,
        skipIntroSeconds: typeof parsed.skipIntroSeconds === 'number' ? parsed.skipIntroSeconds : 0,
        autoSkipOutro: parsed.autoSkipOutro !== undefined ? parsed.autoSkipOutro : false,
        skipOutroSeconds: typeof parsed.skipOutroSeconds === 'number' ? parsed.skipOutroSeconds : 0,
        showModeIndicator: parsed.showModeIndicator !== undefined ? parsed.showModeIndicator : false,
        adFilter: parsed.adFilter !== undefined ? parsed.adFilter : false,
        adFilterMode: parsed.adFilterMode || 'heuristic',
        adKeywords: Array.isArray(parsed.adKeywords) ? parsed.adKeywords : [],
        realtimeLatency: parsed.realtimeLatency !== undefined ? parsed.realtimeLatency : false,
        searchDisplayMode: parsed.searchDisplayMode === 'grouped' ? 'grouped' : 'normal',
        episodeReverseOrder: parsed.episodeReverseOrder !== undefined ? parsed.episodeReverseOrder : false,
        fullscreenType: (parsed.fullscreenType === 'window' || parsed.fullscreenType === 'native' || parsed.fullscreenType === 'auto') ? parsed.fullscreenType : 'auto',
        proxyMode: (parsed.proxyMode === 'retry' || parsed.proxyMode === 'none' || parsed.proxyMode === 'always') ? parsed.proxyMode : 'retry',
        rememberScrollPosition: parsed.rememberScrollPosition !== undefined ? parsed.rememberScrollPosition : true,
        personalizedRecommendations: parsed.personalizedRecommendations !== undefined ? parsed.personalizedRecommendations : true,
        danmakuEnabled: parsed.danmakuEnabled !== undefined ? parsed.danmakuEnabled : false,
        danmakuApiUrl: typeof parsed.danmakuApiUrl === 'string' ? (parsed.danmakuApiUrl || process.env.NEXT_PUBLIC_DANMAKU_API_URL || '') : (process.env.NEXT_PUBLIC_DANMAKU_API_URL || ''),
        danmakuOpacity: typeof parsed.danmakuOpacity === 'number' ? parsed.danmakuOpacity : 0.7,
        danmakuFontSize: typeof parsed.danmakuFontSize === 'number' ? parsed.danmakuFontSize : 20,
        danmakuDisplayArea: typeof parsed.danmakuDisplayArea === 'number' ? parsed.danmakuDisplayArea : 0.5,
        locale: parsed.locale === 'zh-TW' ? 'zh-TW' : 'zh-CN',
      };
    } catch {
      // Even if localStorage fails, we should return defaults + ENV subscriptions
      return getDefaultAppSettings();
    }
  },

  listeners: new Set<() => void>(),

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },

  notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  },

  saveSettings(settings: AppSettings): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      this.notifyListeners();
    }
  },

  exportSettings(includeHistory: boolean = true): string {
    return exportSettings(this.getSettings(), includeHistory);
  },

  importSettings(jsonString: string): boolean {
    return importSettings(jsonString, (s) => this.saveSettings(s), this.getSettings());
  },

  syncEnvSubscriptions(rawEnvValue: string): void {
    if (typeof window === 'undefined') return;

    const currentSettings = this.getSettings();
    const envSubs = getEnvSubscriptions(rawEnvValue);

    if (envSubs.length === 0) return;

    const mergedSubscriptions = [...currentSettings.subscriptions];
    let changed = false;

    envSubs.forEach(envSub => {
      const existingIndex = mergedSubscriptions.findIndex(s => s.url === envSub.url);
      if (existingIndex > -1) {
        // Only update if something meaningful changed to avoid unnecessary re-renders
        if (mergedSubscriptions[existingIndex].name !== envSub.name) {
          mergedSubscriptions[existingIndex] = {
            ...mergedSubscriptions[existingIndex],
            name: envSub.name,
            autoRefresh: true
          };
          changed = true;
        }
      } else {
        mergedSubscriptions.push(envSub);
        changed = true;
      }
    });

    if (changed) {
      this.saveSettings({
        ...currentSettings,
        subscriptions: mergedSubscriptions
      });
    }
  },

  resetToDefaults(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(SEARCH_HISTORY_KEY);
      localStorage.removeItem(WATCH_HISTORY_KEY);

      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      // Clear cache if available
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach(name => caches.delete(name));
        });
      }
    }
  },
};
