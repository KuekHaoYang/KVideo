/**
 * IPTV Store - Manages IPTV/M3U playlist sources and cached channels
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseM3U, groupChannelsByName, extractPlaylistReferences, type M3UChannel } from '@/lib/utils/m3u-parser';

export interface IPTVSource {
  id: string;
  name: string;
  url: string;
  addedAt: number;
  kind?: 'custom' | 'builtin';
}

interface IPTVState {
  sources: IPTVSource[];
  cachedChannels: M3UChannel[];
  cachedGroups: string[];
  cachedChannelsBySource: Record<string, { channels: M3UChannel[]; groups: string[] }>;
  lastRefreshed: number;
  isLoading: boolean;
}

interface IPTVActions {
  addSource: (name: string, url: string) => void;
  removeSource: (id: string) => void;
  updateSource: (id: string, updates: Partial<Pick<IPTVSource, 'name' | 'url'>>) => void;
  syncBuiltinSources: (entries: Array<{ name: string; url: string }>) => void;
  refreshSources: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

interface IPTVStore extends IPTVState, IPTVActions {}

const MAX_CONCURRENT = 3;
const MAX_REFERENCE_DEPTH = 3;
const MAX_REFERENCES_PER_FILE = 25;

async function fetchWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

function buildIPTVProxyUrl(url: string, ua?: string, referer?: string): string {
  const params = new URLSearchParams({ url });
  if (ua) params.set('ua', ua);
  if (referer) params.set('referer', referer);
  return `/api/iptv?${params.toString()}`;
}

async function loadPlaylistChannels(
  rootSource: IPTVSource,
  target: { name: string; url: string; httpUserAgent?: string; httpReferrer?: string },
  visited: Set<string>,
  depth: number = 0
): Promise<{ channels: M3UChannel[]; groups: string[] }> {
  if (!target.url || visited.has(target.url) || depth > MAX_REFERENCE_DEPTH) {
    return { channels: [], groups: [] };
  }

  visited.add(target.url);

  try {
    const res = await fetch(buildIPTVProxyUrl(target.url, target.httpUserAgent, target.httpReferrer));
    if (!res.ok) {
      return { channels: [], groups: [] };
    }

    const text = await res.text();
    const playlist = parseM3U(text, target.url);
    const directChannels = playlist.channels.map((channel) => ({
      ...channel,
      group: channel.group || (depth > 0 ? target.name : channel.group),
      sourceId: rootSource.id,
      sourceName: rootSource.name,
      httpUserAgent: channel.httpUserAgent || target.httpUserAgent,
      httpReferrer: channel.httpReferrer || target.httpReferrer,
    }));

    const directGroups = new Set(playlist.groups);
    if (depth > 0 && directChannels.some((channel) => channel.group === target.name)) {
      directGroups.add(target.name);
    }

    const references = extractPlaylistReferences(text, target.url).slice(0, MAX_REFERENCES_PER_FILE);
    if (references.length === 0) {
      return { channels: directChannels, groups: Array.from(directGroups).sort() };
    }

    const nestedResults = await fetchWithConcurrencyLimit(
      references.map((reference) => async () =>
        loadPlaylistChannels(
          rootSource,
          {
            name: reference.name,
            url: reference.url,
            httpUserAgent: reference.httpUserAgent,
            httpReferrer: reference.httpReferrer,
          },
          visited,
          depth + 1
        )
      ),
      MAX_CONCURRENT
    );

    const mergedChannels = [...directChannels, ...nestedResults.flatMap((result) => result.channels)];
    const mergedGroups = new Set<string>([
      ...Array.from(directGroups),
      ...nestedResults.flatMap((result) => result.groups),
    ]);

    return {
      channels: mergedChannels,
      groups: Array.from(mergedGroups).sort(),
    };
  } catch {
    return { channels: [], groups: [] };
  }
}

export const useIPTVStore = create<IPTVStore>()(
  persist(
    (set, get) => ({
      sources: [],
      cachedChannels: [],
      cachedGroups: [],
      cachedChannelsBySource: {},
      lastRefreshed: 0,
      isLoading: false,

      addSource: (name, url) => {
        const id = `iptv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
          sources: [...state.sources, { id, name, url, addedAt: Date.now(), kind: 'custom' }],
        }));
      },

      removeSource: (id) => {
        set((state) => ({
          sources: state.sources.filter((s) => s.id !== id),
        }));
      },

      updateSource: (id, updates) => {
        set((state) => ({
          sources: state.sources.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      syncBuiltinSources: (entries) => {
        set((state) => {
          const customSources = state.sources.filter((source) => source.kind !== 'builtin');
          const existingUrls = new Set(customSources.map((source) => source.url));
          const builtinSources = entries
            .filter((entry) => entry.url.trim())
            .filter((entry) => !existingUrls.has(entry.url))
            .map((entry, index) => ({
              id: `iptv-builtin-${index}-${entry.url}`,
              name: entry.name || `直播源 ${index + 1}`,
              url: entry.url,
              addedAt: Date.now(),
              kind: 'builtin' as const,
            }));

          return {
            sources: [...customSources, ...builtinSources],
          };
        });
      },

      refreshSources: async () => {
        const { sources } = get();
        if (sources.length === 0) {
          set({ cachedChannels: [], cachedGroups: [], cachedChannelsBySource: {}, lastRefreshed: Date.now() });
          return;
        }

        set({ isLoading: true });

        try {
          const allChannels: M3UChannel[] = [];
          const allGroups = new Set<string>();
          const channelsBySourceRaw: Record<string, M3UChannel[]> = {};
          const groupsBySource: Record<string, Set<string>> = {};

          const tasks = sources.map((source) => async () => {
            try {
              const playlist = await loadPlaylistChannels(
                source,
                { name: source.name, url: source.url },
                new Set<string>()
              );
              // Tag channels with source info
              const tagged = playlist.channels;
              allChannels.push(...tagged);
              playlist.groups.forEach((g) => allGroups.add(g));
              // Track per-source
              channelsBySourceRaw[source.id] = tagged;
              groupsBySource[source.id] = new Set(playlist.groups);
            } catch (e) {
              console.error(`Failed to fetch IPTV source: ${source.name}`, e);
            }
          });

          await fetchWithConcurrencyLimit(tasks, MAX_CONCURRENT);

          // Group channels with the same name into multi-route entries
          const grouped = groupChannelsByName(allChannels);

          // Build per-source grouped data
          const cachedChannelsBySource: Record<string, { channels: M3UChannel[]; groups: string[] }> = {};
          for (const source of sources) {
            const raw = channelsBySourceRaw[source.id];
            if (raw) {
              cachedChannelsBySource[source.id] = {
                channels: groupChannelsByName(raw),
                groups: Array.from(groupsBySource[source.id] || []).sort(),
              };
            }
          }

          set({
            cachedChannels: grouped,
            cachedGroups: Array.from(allGroups).sort(),
            cachedChannelsBySource,
            lastRefreshed: Date.now(),
            isLoading: false,
          });
        } catch {
          set({ isLoading: false });
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'kvideo-iptv-store',
      partialize: (state) => ({
        sources: state.sources.filter((source) => source.kind !== 'builtin'),
        lastRefreshed: state.lastRefreshed,
        // Don't persist cachedChannels/cachedGroups - they can be very large
        // and will be re-fetched on page load
      }),
    }
  )
);
