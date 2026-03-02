import { useState, useEffect } from 'react';
import { settingsStore, getDefaultPremiumSources, type SortOption, type SearchDisplayMode, type ProxyMode, type LocaleOption } from '@/lib/store/settings-store';
import { premiumModeSettingsStore } from '@/lib/store/premium-mode-settings';
import type { VideoSource } from '@/lib/types';

export function usePremiumSettingsPage() {
    const [premiumSources, setPremiumSources] = useState<VideoSource[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isRestoreDefaultsDialogOpen, setIsRestoreDefaultsDialogOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<VideoSource | null>(null);

    // Display settings (from premium mode settings store)
    const [realtimeLatency, setRealtimeLatency] = useState(false);
    const [searchDisplayMode, setSearchDisplayMode] = useState<SearchDisplayMode>('normal');
    const [fullscreenType, setFullscreenType] = useState<'auto' | 'native' | 'window'>('auto');
    const [proxyMode, setProxyMode] = useState<ProxyMode>('retry');
    const [rememberScrollPosition, setRememberScrollPosition] = useState(true);
    const [locale, setLocale] = useState<LocaleOption>('zh-CN');

    // Danmaku settings
    const [danmakuApiUrl, setDanmakuApiUrl] = useState('');
    const [danmakuOpacity, setDanmakuOpacity] = useState(0.7);
    const [danmakuFontSize, setDanmakuFontSize] = useState(20);
    const [danmakuDisplayArea, setDanmakuDisplayArea] = useState(0.5);

    useEffect(() => {
        // Sources come from main settings store
        const settings = settingsStore.getSettings();
        setPremiumSources(settings.premiumSources || []);
        setLocale(settings.locale);

        // Mode-specific settings come from premium mode settings store
        const modeSettings = premiumModeSettingsStore.getSettings();
        setRealtimeLatency(modeSettings.realtimeLatency);
        setSearchDisplayMode(modeSettings.searchDisplayMode);
        setFullscreenType(modeSettings.fullscreenType);
        setProxyMode(modeSettings.proxyMode);
        setRememberScrollPosition(modeSettings.rememberScrollPosition);
        setDanmakuApiUrl(modeSettings.danmakuApiUrl);
        setDanmakuOpacity(modeSettings.danmakuOpacity);
        setDanmakuFontSize(modeSettings.danmakuFontSize);
        setDanmakuDisplayArea(modeSettings.danmakuDisplayArea);
    }, []);

    // --- Source management (uses main settingsStore) ---

    const handleSourcesChange = (newSources: VideoSource[]) => {
        setPremiumSources(newSources);
        const currentSettings = settingsStore.getSettings();
        settingsStore.saveSettings({
            ...currentSettings,
            premiumSources: newSources,
        });
    };

    const handleAddSource = (source: VideoSource) => {
        const exists = premiumSources.some(s => s.id === source.id);
        const updated = exists
            ? premiumSources.map(s => s.id === source.id ? source : s)
            : [...premiumSources, source];
        handleSourcesChange(updated);
        setEditingSource(null);
    };

    const handleEditSource = (source: VideoSource) => {
        setEditingSource(source);
        setIsAddModalOpen(true);
    };

    const handleRestoreDefaults = () => {
        const defaults = getDefaultPremiumSources();
        handleSourcesChange(defaults);
        setIsRestoreDefaultsDialogOpen(false);
    };

    // --- Premium mode settings helpers ---

    const savePremiumModeSetting = (partial: Record<string, any>) => {
        const current = premiumModeSettingsStore.getSettings();
        premiumModeSettingsStore.saveSettings({ ...current, ...partial });
    };

    // --- Display settings handlers ---

    const handleRealtimeLatencyChange = (enabled: boolean) => {
        setRealtimeLatency(enabled);
        savePremiumModeSetting({ realtimeLatency: enabled });
    };

    const handleSearchDisplayModeChange = (mode: SearchDisplayMode) => {
        setSearchDisplayMode(mode);
        savePremiumModeSetting({ searchDisplayMode: mode });
    };

    const handleFullscreenTypeChange = (type: 'auto' | 'native' | 'window') => {
        setFullscreenType(type);
        savePremiumModeSetting({ fullscreenType: type });
    };

    const handleProxyModeChange = (mode: ProxyMode) => {
        setProxyMode(mode);
        savePremiumModeSetting({ proxyMode: mode });
    };

    const handleRememberScrollPositionChange = (enabled: boolean) => {
        setRememberScrollPosition(enabled);
        savePremiumModeSetting({ rememberScrollPosition: enabled });
    };

    const handleLocaleChange = (newLocale: LocaleOption) => {
        setLocale(newLocale);
        // Locale is a global setting, save to main store
        const currentSettings = settingsStore.getSettings();
        settingsStore.saveSettings({ ...currentSettings, locale: newLocale });
    };

    // --- Danmaku settings handlers ---

    const handleDanmakuApiUrlChange = (url: string) => {
        setDanmakuApiUrl(url);
        savePremiumModeSetting({ danmakuApiUrl: url });
    };

    const handleDanmakuOpacityChange = (value: number) => {
        const clamped = Math.max(0.1, Math.min(1, value));
        setDanmakuOpacity(clamped);
        savePremiumModeSetting({ danmakuOpacity: clamped });
    };

    const handleDanmakuFontSizeChange = (value: number) => {
        setDanmakuFontSize(value);
        savePremiumModeSetting({ danmakuFontSize: value });
    };

    const handleDanmakuDisplayAreaChange = (value: number) => {
        setDanmakuDisplayArea(value);
        savePremiumModeSetting({ danmakuDisplayArea: value });
    };

    return {
        premiumSources,
        isAddModalOpen,
        isRestoreDefaultsDialogOpen,
        setIsAddModalOpen,
        setIsRestoreDefaultsDialogOpen,
        setEditingSource,
        handleSourcesChange,
        handleAddSource,
        handleRestoreDefaults,
        editingSource,
        handleEditSource,
        // Display settings
        realtimeLatency,
        searchDisplayMode,
        fullscreenType,
        proxyMode,
        rememberScrollPosition,
        handleRealtimeLatencyChange,
        handleSearchDisplayModeChange,
        handleFullscreenTypeChange,
        handleProxyModeChange,
        handleRememberScrollPositionChange,
        locale,
        handleLocaleChange,
        // Danmaku settings
        danmakuApiUrl,
        handleDanmakuApiUrlChange,
        danmakuOpacity,
        handleDanmakuOpacityChange,
        danmakuFontSize,
        handleDanmakuFontSizeChange,
        danmakuDisplayArea,
        handleDanmakuDisplayAreaChange,
    };
}
