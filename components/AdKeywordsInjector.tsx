'use client';

import { useEffect } from 'react';
import { settingsStore } from '@/lib/store/settings-store';

interface AdKeywordsInjectorProps {
    keywords: string[];
}

export function AdKeywordsInjector({ keywords }: AdKeywordsInjectorProps) {
    useEffect(() => {
        const normalizedKeywords = [...new Set(
            keywords
                .map((keyword) => keyword.trim())
                .filter((keyword) => keyword.length > 0)
        )];
        const currentSettings = settingsStore.getSettings();

        const isUnchanged =
            currentSettings.adKeywords.length === normalizedKeywords.length &&
            currentSettings.adKeywords.every((keyword, index) => keyword === normalizedKeywords[index]);

        if (!isUnchanged) {
            settingsStore.saveSettings({
                ...currentSettings,
                adKeywords: normalizedKeywords,
            });
        }
    }, [keywords]);

    return null;
}
