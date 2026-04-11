/**
 * User Sources Store - Per-user video sources and danmaku APIs
 * Uses localStorage keyed by profileId for isolation between users
 */

import { getProfileId } from './auth-store';
import type { VideoSource } from '@/lib/types';

export interface DanmakuApiEntry {
  id: string;
  name: string;
  url: string;
}

interface UserSourcesState {
  sources: VideoSource[];
  danmakuApis: DanmakuApiEntry[];
  activeDanmakuApiId: string | null;
}

function getStorageKey(): string {
  const profileId = getProfileId();
  return `kvideo-user-sources-${profileId}`;
}

function getState(): UserSourcesState {
  if (typeof window === 'undefined') {
    return { sources: [], danmakuApis: [], activeDanmakuApiId: null };
  }
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return { sources: [], danmakuApis: [], activeDanmakuApiId: null };
    const parsed = JSON.parse(raw);
    return {
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      danmakuApis: Array.isArray(parsed.danmakuApis) ? parsed.danmakuApis : [],
      activeDanmakuApiId: parsed.activeDanmakuApiId ?? null,
    };
  } catch {
    return { sources: [], danmakuApis: [], activeDanmakuApiId: null };
  }
}

function saveState(state: UserSourcesState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
  userSourcesStore.notifyListeners();
}

export const userSourcesStore = {
  listeners: new Set<() => void>(),

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  },

  notifyListeners(): void {
    this.listeners.forEach(l => l());
  },

  getState,

  getSources(): VideoSource[] {
    return getState().sources;
  },

  getDanmakuApis(): DanmakuApiEntry[] {
    return getState().danmakuApis;
  },

  getActiveDanmakuApi(): DanmakuApiEntry | null {
    const state = getState();
    if (!state.activeDanmakuApiId) return null;
    return state.danmakuApis.find(a => a.id === state.activeDanmakuApiId) ?? null;
  },

  addSource(source: VideoSource): void {
    const state = getState();
    if (state.sources.find(s => s.id === source.id)) return;
    saveState({ ...state, sources: [...state.sources, { ...source, enabled: true }] });
  },

  removeSource(id: string): void {
    const state = getState();
    saveState({ ...state, sources: state.sources.filter(s => s.id !== id) });
  },

  toggleSource(id: string): void {
    const state = getState();
    saveState({
      ...state,
      sources: state.sources.map(s =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    });
  },

  addDanmakuApi(entry: DanmakuApiEntry): void {
    const state = getState();
    if (state.danmakuApis.find(a => a.id === entry.id)) return;
    saveState({ ...state, danmakuApis: [...state.danmakuApis, entry] });
  },

  removeDanmakuApi(id: string): void {
    const state = getState();
    const newApis = state.danmakuApis.filter(a => a.id !== id);
    const newActiveId = state.activeDanmakuApiId === id ? null : state.activeDanmakuApiId;
    saveState({ ...state, danmakuApis: newApis, activeDanmakuApiId: newActiveId });
  },

  setActiveDanmakuApi(id: string | null): void {
    const state = getState();
    saveState({ ...state, activeDanmakuApiId: id });
  },
};
