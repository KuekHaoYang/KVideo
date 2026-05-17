/**
 * useLatencyPing - Hook for real-time latency measurement
 * Periodically pings video sources when enabled
 */

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { settingsStore } from '@/lib/store/settings-store';

interface LatencyState {
    [sourceId: string]: number;
}

interface UseLatencyPingOptions {
    sourceUrls: { id: string; baseUrl: string }[];
    enabled?: boolean;
    intervalMs?: number;
}

export function useLatencyPing({
    sourceUrls,
    enabled = true,
    intervalMs = 5000,
}: UseLatencyPingOptions) {
    const [latencies, setLatencies] = useState<LatencyState>({});
    const [isLoading, setIsLoading] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);
    const realtimeEnabled = useSyncExternalStore(
        (listener) => settingsStore.subscribe(listener),
        () => settingsStore.getSettings().realtimeLatency,
        () => false,
    );

    const pingSource = useCallback(async (sourceId: string, baseUrl: string): Promise<number | null> => {
        try {
            const response = await fetch('/api/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: baseUrl }),
            });

            if (response.ok) {
                const data = await response.json();
                return data.latency || null;
            }
            return null;
        } catch {
            return null;
        }
    }, []);

    const pingAllSources = useCallback(async () => {
        if (!mountedRef.current || sourceUrls.length === 0) return;

        setIsLoading(true);

        const results = await Promise.all(
            sourceUrls.map(async ({ id, baseUrl }) => {
                const latency = await pingSource(id, baseUrl);
                return { id, latency };
            })
        );

        if (mountedRef.current) {
            setLatencies(prev => {
                const newState = { ...prev };
                results.forEach(({ id, latency }) => {
                    if (latency !== null) {
                        newState[id] = latency;
                    }
                });
                return newState;
            });
            setIsLoading(false);
        }
    }, [sourceUrls, pingSource]);

    // Start/stop polling based on enabled state
    useEffect(() => {
        mountedRef.current = true;
        let initialTimeout: NodeJS.Timeout | null = null;

        const shouldPoll = enabled && realtimeEnabled && sourceUrls.length > 0;

        if (shouldPoll) {
            initialTimeout = setTimeout(() => {
                void pingAllSources();
            }, 0);

            intervalRef.current = setInterval(() => {
                void pingAllSources();
            }, intervalMs);
        }

        return () => {
            mountedRef.current = false;
            if (initialTimeout) {
                clearTimeout(initialTimeout);
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, realtimeEnabled, sourceUrls, intervalMs, pingAllSources]);

    const refreshLatency = useCallback((sourceId: string) => {
        const source = sourceUrls.find(s => s.id === sourceId);
        if (source) {
            pingSource(sourceId, source.baseUrl).then(latency => {
                if (latency !== null && mountedRef.current) {
                    setLatencies(prev => ({ ...prev, [sourceId]: latency }));
                }
            });
        }
    }, [sourceUrls, pingSource]);

    const refreshAll = useCallback(() => {
        pingAllSources();
    }, [pingAllSources]);

    return {
        latencies,
        isLoading,
        refreshLatency,
        refreshAll,
        isRealtimeEnabled: realtimeEnabled,
    };
}
