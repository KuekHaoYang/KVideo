/**
 * useConfigSync - Syncs user settings to the server for cross-device
 * and PWA persistence. Pulls on mount, pushes on change.
 */

import { useEffect, useRef, useCallback } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import { getProfileId } from '@/lib/store/auth-store';

const DEBOUNCE_MS = 3000;

export function useConfigSync() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPulled = useRef(false);

  const getHeaders = useCallback(() => {
    const profileId = getProfileId();
    if (!profileId) return null;
    return {
      'x-profile-id': profileId,
      'Content-Type': 'application/json',
    };
  }, []);

  // Pull config from server on mount (once)
  useEffect(() => {
    if (hasPulled.current) return;
    hasPulled.current = true;

    const pull = async () => {
      const headers = getHeaders();
      if (!headers) return;

      try {
        const res = await fetch('/api/user/config', { headers });
        const result = await res.json();

        if (result.success && result.data) {
          const serverData = result.data;
          const local = settingsStore.getSettings();

          // Only merge server data if it's newer or local is default
          const serverTime = serverData.updatedAt || 0;
          const localStr = localStorage.getItem('kvideo-settings');
          const localTime = localStr
            ? JSON.parse(localStr)?._syncedAt || 0
            : 0;

          if (serverTime > localTime) {
            // Server is newer — merge server settings into local
            const merged = { ...local };

            if (serverData.sources?.length > 0) {
              merged.sources = serverData.sources;
            }
            if (serverData.premiumSources?.length > 0) {
              merged.premiumSources = serverData.premiumSources;
            }
            if (serverData.subscriptions?.length > 0) {
              merged.subscriptions = serverData.subscriptions;
            }
            if (serverData.blockedCategories) {
              merged.blockedCategories = serverData.blockedCategories;
            }

            settingsStore.saveSettings(merged);

            // Update sync timestamp
            const stored = localStorage.getItem('kvideo-settings');
            if (stored) {
              const parsed = JSON.parse(stored);
              parsed._syncedAt = serverTime;
              localStorage.setItem(
                'kvideo-settings',
                JSON.stringify(parsed)
              );
            }
          }
        }
      } catch {
        // Server may not be available (e.g. Cloudflare Pages)
      }
    };

    pull();
  }, [getHeaders]);

  // Push config to server on settings change (debounced)
  useEffect(() => {
    const push = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        const headers = getHeaders();
        if (!headers) return;

        try {
          const settings = settingsStore.getSettings();
          await fetch('/api/user/config', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              sources: settings.sources,
              premiumSources: settings.premiumSources,
              subscriptions: settings.subscriptions,
              blockedCategories: settings.blockedCategories,
              sortBy: settings.sortBy,
              locale: settings.locale,
            }),
          });

          // Update local sync timestamp
          const stored = localStorage.getItem('kvideo-settings');
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed._syncedAt = Date.now();
            localStorage.setItem(
              'kvideo-settings',
              JSON.stringify(parsed)
            );
          }
        } catch {
          // Silently fail — local storage is the primary source
        }
      }, DEBOUNCE_MS);
    };

    const unsubscribe = settingsStore.subscribe(push);
    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [getHeaders]);
}
