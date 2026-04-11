'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import { userSourcesStore } from '@/lib/store/user-sources-store';
import { parseDanmakuResponse, parseSearchResults, matchEpisode, fuzzyMatchTitle } from '@/lib/utils/danmaku-utils';
import type { DanmakuComment } from '@/lib/types/danmaku';

interface UseDanmakuOptions {
  videoTitle: string;
  episodeName: string;
  episodeIndex?: number;
}

interface UseDanmakuReturn {
  danmakuEnabled: boolean;
  setDanmakuEnabled: (v: boolean) => void;
  comments: DanmakuComment[];
  isLoading: boolean;
  error: string | null;
}

export function useDanmaku({ videoTitle, episodeName, episodeIndex }: UseDanmakuOptions): UseDanmakuReturn {
  const [danmakuEnabled, setDanmakuEnabledState] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [comments, setComments] = useState<DanmakuComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedKeyRef = useRef('');

  // Sync with settings store + user danmaku API override
  useEffect(() => {
    const updateApi = () => {
      const s = settingsStore.getSettings();
      setDanmakuEnabledState(s.danmakuEnabled);

      // User's active danmaku API takes priority over system setting
      const userApi = userSourcesStore.getActiveDanmakuApi();
      setApiUrl(userApi ? userApi.url : s.danmakuApiUrl);
    };

    updateApi();

    const unsub1 = settingsStore.subscribe(updateApi);
    const unsub2 = userSourcesStore.subscribe(updateApi);
    return () => { unsub1(); unsub2(); };
  }, []);

  const setDanmakuEnabled = useCallback((v: boolean) => {
    const s = settingsStore.getSettings();
    settingsStore.saveSettings({ ...s, danmakuEnabled: v });
  }, []);

  // Fetch danmaku comments when enabled and API URL is configured
  useEffect(() => {
    if (!danmakuEnabled || !apiUrl || !videoTitle) {
      setComments([]);
      return;
    }

    const fetchKey = `${apiUrl}|${videoTitle}|${episodeName}`;
    if (fetchKey === fetchedKeyRef.current) return;
    fetchedKeyRef.current = fetchKey;

    let cancelled = false;

    async function fetchDanmaku() {
      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Search for the anime
        const searchUrl = `/api/danmaku?action=search&keyword=${encodeURIComponent(videoTitle)}&apiUrl=${encodeURIComponent(apiUrl)}`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
        const searchData = await searchRes.json();

        if (cancelled) return;

        const results = parseSearchResults(searchData);
        if (!results.length) {
          setComments([]);
          setIsLoading(false);
          return;
        }

        // Step 2: Match title
        const matched = fuzzyMatchTitle(results, videoTitle);
        if (!matched || !matched.episodes.length) {
          setComments([]);
          setIsLoading(false);
          return;
        }

        // Step 3: Match episode
        const ep = matchEpisode(matched.episodes, episodeName, episodeIndex);
        if (!ep) {
          setComments([]);
          setIsLoading(false);
          return;
        }

        // Step 4: Fetch comments
        const commentsUrl = `/api/danmaku?action=comments&episodeId=${encodeURIComponent(String(ep.episodeId))}&apiUrl=${encodeURIComponent(apiUrl)}`;
        const commentsRes = await fetch(commentsUrl);
        if (!commentsRes.ok) throw new Error(`Comments fetch failed: ${commentsRes.status}`);
        const commentsData = await commentsRes.json();

        if (cancelled) return;

        const parsed = parseDanmakuResponse(commentsData);
        setComments(parsed);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load danmaku');
          setComments([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchDanmaku();
    return () => { cancelled = true; };
  }, [danmakuEnabled, apiUrl, videoTitle, episodeName, episodeIndex]);

  return { danmakuEnabled, setDanmakuEnabled, comments, isLoading, error };
}
