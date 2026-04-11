/**
 * Premium Mode Settings Store
 * Stores player/display settings separately for premium mode.
 * Mirrors the relevant subset of AppSettings but uses its own localStorage key.
 */

import {
  type SortOption,
  type SearchDisplayMode,
  type ProxyMode,
  type AdFilterMode,
  DEFAULT_SEEK_STEP_SECONDS,
  normalizeSeekStepSeconds,
} from './settings-store';

const PREMIUM_MODE_SETTINGS_KEY = 'kvideo-premium-mode-settings';

export interface ModeSettings {
  sortBy: SortOption;
  autoNextEpisode: boolean;
  autoSkipIntro: boolean;
  skipIntroSeconds: number;
  autoSkipOutro: boolean;
  skipOutroSeconds: number;
  seekStepSeconds: number;
  showModeIndicator: boolean;
  adFilterMode: AdFilterMode;
  fullscreenType: 'auto' | 'native' | 'window';
  proxyMode: ProxyMode;
  realtimeLatency: boolean;
  searchDisplayMode: SearchDisplayMode;
  episodeReverseOrder: boolean;
  rememberScrollPosition: boolean;
  personalizedRecommendations: boolean;
  danmakuEnabled: boolean;
  danmakuApiUrl: string;
  danmakuOpacity: number;
  danmakuFontSize: number;
  danmakuDisplayArea: number;
}

function getDefaultModeSettings(): ModeSettings {
  return {
    sortBy: 'default',
    autoNextEpisode: true,
    autoSkipIntro: false,
    skipIntroSeconds: 0,
    autoSkipOutro: false,
    skipOutroSeconds: 0,
    seekStepSeconds: DEFAULT_SEEK_STEP_SECONDS,
    showModeIndicator: false,
    adFilterMode: 'heuristic',
    fullscreenType: 'auto',
    proxyMode: 'retry',
    realtimeLatency: false,
    searchDisplayMode: 'normal',
    episodeReverseOrder: false,
    rememberScrollPosition: true,
    personalizedRecommendations: true,
    danmakuEnabled: false,
    danmakuApiUrl: process.env.NEXT_PUBLIC_DANMAKU_API_URL || '',
    danmakuOpacity: 0.7,
    danmakuFontSize: 20,
    danmakuDisplayArea: 0.5,
  };
}

export const premiumModeSettingsStore = {
  getSettings(): ModeSettings {
    if (typeof window === 'undefined') {
      return getDefaultModeSettings();
    }

    const stored = localStorage.getItem(PREMIUM_MODE_SETTINGS_KEY);
    if (!stored) {
      return getDefaultModeSettings();
    }

    try {
      const parsed = JSON.parse(stored);
      return {
        sortBy: parsed.sortBy || 'default',
        autoNextEpisode: parsed.autoNextEpisode !== undefined ? parsed.autoNextEpisode : true,
        autoSkipIntro: parsed.autoSkipIntro !== undefined ? parsed.autoSkipIntro : false,
        skipIntroSeconds: typeof parsed.skipIntroSeconds === 'number' ? parsed.skipIntroSeconds : 0,
        autoSkipOutro: parsed.autoSkipOutro !== undefined ? parsed.autoSkipOutro : false,
        skipOutroSeconds: typeof parsed.skipOutroSeconds === 'number' ? parsed.skipOutroSeconds : 0,
        seekStepSeconds: normalizeSeekStepSeconds(parsed.seekStepSeconds),
        showModeIndicator: parsed.showModeIndicator !== undefined ? parsed.showModeIndicator : false,
        adFilterMode: parsed.adFilterMode || 'heuristic',
        fullscreenType: (parsed.fullscreenType === 'window' || parsed.fullscreenType === 'native' || parsed.fullscreenType === 'auto') ? parsed.fullscreenType : 'auto',
        proxyMode: (parsed.proxyMode === 'retry' || parsed.proxyMode === 'none' || parsed.proxyMode === 'always') ? parsed.proxyMode : 'retry',
        realtimeLatency: parsed.realtimeLatency !== undefined ? parsed.realtimeLatency : false,
        searchDisplayMode: parsed.searchDisplayMode === 'grouped' ? 'grouped' : 'normal',
        episodeReverseOrder: parsed.episodeReverseOrder !== undefined ? parsed.episodeReverseOrder : false,
        rememberScrollPosition: parsed.rememberScrollPosition !== undefined ? parsed.rememberScrollPosition : true,
        personalizedRecommendations: parsed.personalizedRecommendations !== undefined ? parsed.personalizedRecommendations : true,
        danmakuEnabled: parsed.danmakuEnabled !== undefined ? parsed.danmakuEnabled : false,
        danmakuApiUrl: typeof parsed.danmakuApiUrl === 'string' ? (parsed.danmakuApiUrl || process.env.NEXT_PUBLIC_DANMAKU_API_URL || '') : (process.env.NEXT_PUBLIC_DANMAKU_API_URL || ''),
        danmakuOpacity: typeof parsed.danmakuOpacity === 'number' ? parsed.danmakuOpacity : 0.7,
        danmakuFontSize: typeof parsed.danmakuFontSize === 'number' ? parsed.danmakuFontSize : 20,
        danmakuDisplayArea: typeof parsed.danmakuDisplayArea === 'number' ? parsed.danmakuDisplayArea : 0.5,
      };
    } catch {
      return getDefaultModeSettings();
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

  saveSettings(settings: ModeSettings): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREMIUM_MODE_SETTINGS_KEY, JSON.stringify(settings));
      this.notifyListeners();
    }
  },
};

/**
 * Helper to get mode-specific settings from the correct store.
 * Normal mode reads from settingsStore, premium mode reads from premiumModeSettingsStore.
 */
export function getModeSettings(isPremium: boolean): ModeSettings {
  if (isPremium) {
    return premiumModeSettingsStore.getSettings();
  }
  // For normal mode, extract ModeSettings-shaped data from the main settingsStore
  // Import dynamically to avoid circular dependencies
  const { settingsStore } = require('./settings-store');
  const s = settingsStore.getSettings();
  return {
    sortBy: s.sortBy,
    autoNextEpisode: s.autoNextEpisode,
    autoSkipIntro: s.autoSkipIntro,
    skipIntroSeconds: s.skipIntroSeconds,
    autoSkipOutro: s.autoSkipOutro,
    skipOutroSeconds: s.skipOutroSeconds,
    seekStepSeconds: s.seekStepSeconds,
    showModeIndicator: s.showModeIndicator,
    adFilterMode: s.adFilterMode,
    fullscreenType: s.fullscreenType,
    proxyMode: s.proxyMode,
    realtimeLatency: s.realtimeLatency,
    searchDisplayMode: s.searchDisplayMode,
    episodeReverseOrder: s.episodeReverseOrder,
    rememberScrollPosition: s.rememberScrollPosition,
    personalizedRecommendations: s.personalizedRecommendations,
    danmakuEnabled: s.danmakuEnabled,
    danmakuApiUrl: s.danmakuApiUrl,
    danmakuOpacity: s.danmakuOpacity,
    danmakuFontSize: s.danmakuFontSize,
    danmakuDisplayArea: s.danmakuDisplayArea,
  };
}

/**
 * Helper to get the settings store for a given mode.
 */
export function getModeSettingsStore(isPremium: boolean) {
  if (isPremium) {
    return premiumModeSettingsStore;
  }
  // Return a wrapper around the main settingsStore that conforms to the same interface
  const { settingsStore } = require('./settings-store');
  return {
    getSettings: () => getModeSettings(false),
    subscribe: (listener: () => void) => settingsStore.subscribe(listener),
    saveSettings: (modeSettings: ModeSettings) => {
      const current = settingsStore.getSettings();
      settingsStore.saveSettings({
        ...current,
        ...modeSettings,
      });
    },
  };
}
