'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    settingsStore,
    type AppSettings,
    type AdFilterMode,
} from '@/lib/store/settings-store';
import {
    premiumModeSettingsStore,
    type ModeSettings,
} from '@/lib/store/premium-mode-settings';
import { useRuntimeFeatures } from '@/components/RuntimeFeaturesProvider';

interface PlayerSettingsSnapshot {
    autoNextEpisode: boolean;
    autoSkipIntro: boolean;
    skipIntroSeconds: number;
    autoSkipOutro: boolean;
    skipOutroSeconds: number;
    showModeIndicator: boolean;
    adFilter: boolean;
    adFilterMode: AdFilterMode;
    adKeywords: string[];
    fullscreenType: 'auto' | 'native' | 'window';
    proxyMode: 'retry' | 'none' | 'always';
    danmakuEnabled: boolean;
    danmakuApiUrl: string;
    danmakuOpacity: number;
    danmakuFontSize: number;
    danmakuDisplayArea: number;
}

function getPlayerSettingsSnapshot(isPremium: boolean, mediaProxyEnabled: boolean): PlayerSettingsSnapshot {
    const globalSettings = settingsStore.getSettings();
    const modeSettings = isPremium ? premiumModeSettingsStore.getSettings() : globalSettings;

    return {
        autoNextEpisode: modeSettings.autoNextEpisode,
        autoSkipIntro: modeSettings.autoSkipIntro,
        skipIntroSeconds: modeSettings.skipIntroSeconds,
        autoSkipOutro: modeSettings.autoSkipOutro,
        skipOutroSeconds: modeSettings.skipOutroSeconds,
        showModeIndicator: modeSettings.showModeIndicator,
        adFilter: globalSettings.adFilter,
        adFilterMode: modeSettings.adFilterMode,
        adKeywords: globalSettings.adKeywords,
        fullscreenType: modeSettings.fullscreenType,
        proxyMode: mediaProxyEnabled ? modeSettings.proxyMode : 'none',
        danmakuEnabled: modeSettings.danmakuEnabled,
        danmakuApiUrl: modeSettings.danmakuApiUrl,
        danmakuOpacity: modeSettings.danmakuOpacity,
        danmakuFontSize: modeSettings.danmakuFontSize,
        danmakuDisplayArea: modeSettings.danmakuDisplayArea,
    };
}

/**
 * Hook to access and update player settings from the settings store
 * Provides reactive updates when settings change
 */
export function usePlayerSettings(isPremium: boolean = false) {
    const { mediaProxyEnabled } = useRuntimeFeatures();
    const [settings, setSettings] = useState(() => getPlayerSettingsSnapshot(isPremium, mediaProxyEnabled));

    // Subscribe to settings changes
    useEffect(() => {
        const syncSettings = () => {
            setSettings(getPlayerSettingsSnapshot(isPremium, mediaProxyEnabled));
        };

        const modeStore = isPremium ? premiumModeSettingsStore : settingsStore;
        const unsubscribeModeStore = modeStore.subscribe(syncSettings);
        const unsubscribeGlobalStore = isPremium ? settingsStore.subscribe(syncSettings) : null;

        syncSettings();

        return () => {
            unsubscribeModeStore();
            unsubscribeGlobalStore?.();
        };
    }, [isPremium, mediaProxyEnabled]);

    const updateModeSettings = useCallback((partial: Partial<ModeSettings>) => {
        if (isPremium) {
            const currentSettings = premiumModeSettingsStore.getSettings();
            premiumModeSettingsStore.saveSettings({
                ...currentSettings,
                ...partial,
            });
            return;
        }

        const currentSettings = settingsStore.getSettings();
        settingsStore.saveSettings({
            ...currentSettings,
            ...partial,
        });
    }, [isPremium]);

    const updateGlobalSettings = useCallback((partial: Partial<AppSettings>) => {
        const currentSettings = settingsStore.getSettings();
        settingsStore.saveSettings({
            ...currentSettings,
            ...partial,
        });
    }, []);

    const setAutoNextEpisode = useCallback((value: boolean) => {
        updateModeSettings({ autoNextEpisode: value });
    }, [updateModeSettings]);

    const setAutoSkipIntro = useCallback((value: boolean) => {
        updateModeSettings({ autoSkipIntro: value });
    }, [updateModeSettings]);

    const setSkipIntroSeconds = useCallback((value: number) => {
        updateModeSettings({ skipIntroSeconds: Math.max(0, value) });
    }, [updateModeSettings]);

    const setAutoSkipOutro = useCallback((value: boolean) => {
        updateModeSettings({ autoSkipOutro: value });
    }, [updateModeSettings]);

    const setSkipOutroSeconds = useCallback((value: number) => {
        updateModeSettings({ skipOutroSeconds: Math.max(0, value) });
    }, [updateModeSettings]);

    const setShowModeIndicator = useCallback((value: boolean) => {
        updateModeSettings({ showModeIndicator: value });
    }, [updateModeSettings]);

    const setAdFilter = useCallback((value: boolean) => {
        updateGlobalSettings({ adFilter: value });
    }, [updateGlobalSettings]);

    const setAdFilterMode = useCallback((value: AdFilterMode) => {
        updateModeSettings({ adFilterMode: value });
    }, [updateModeSettings]);

    const setAdKeywords = useCallback((value: string[]) => {
        updateGlobalSettings({ adKeywords: value });
    }, [updateGlobalSettings]);

    const setFullscreenType = useCallback((value: 'auto' | 'native' | 'window') => {
        updateModeSettings({ fullscreenType: value });
    }, [updateModeSettings]);

    const setProxyMode = useCallback((value: 'retry' | 'none' | 'always') => {
        updateModeSettings({ proxyMode: mediaProxyEnabled ? value : 'none' });
    }, [mediaProxyEnabled, updateModeSettings]);

    const setDanmakuEnabled = useCallback((value: boolean) => {
        updateModeSettings({ danmakuEnabled: value });
    }, [updateModeSettings]);

    const setDanmakuApiUrl = useCallback((value: string) => {
        updateModeSettings({ danmakuApiUrl: value });
    }, [updateModeSettings]);

    const setDanmakuOpacity = useCallback((value: number) => {
        updateModeSettings({ danmakuOpacity: Math.max(0.1, Math.min(1, value)) });
    }, [updateModeSettings]);

    const setDanmakuFontSize = useCallback((value: number) => {
        updateModeSettings({ danmakuFontSize: value });
    }, [updateModeSettings]);

    const setDanmakuDisplayArea = useCallback((value: number) => {
        updateModeSettings({ danmakuDisplayArea: value });
    }, [updateModeSettings]);

    return {
        ...settings,
        setAutoNextEpisode,
        setAutoSkipIntro,
        setSkipIntroSeconds,
        setAutoSkipOutro,
        setSkipOutroSeconds,
        setShowModeIndicator,
        setAdFilter,
        setAdFilterMode,
        setAdKeywords,
        setFullscreenType,
        setProxyMode,
        setDanmakuEnabled,
        setDanmakuApiUrl,
        setDanmakuOpacity,
        setDanmakuFontSize,
        setDanmakuDisplayArea,
    };
}
