import 'server-only';

import type { VideoSource } from '@/lib/types';
import {
  assertOutboundUrlAllowed,
  sanitizeHeaderMap,
} from '@/lib/server/outbound-policy';

const SOURCE_ID_PATTERN = /^[a-z0-9-]+$/;

function normalizePath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed) || (!trimmed.startsWith('/') && !trimmed.startsWith('?'))) {
    return null;
  }

  return trimmed;
}

export async function normalizeSourceConfig(value: unknown): Promise<VideoSource | null> {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Partial<VideoSource>;
  const id = typeof source.id === 'string' ? source.id.trim().toLowerCase() : '';
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  const baseUrl = typeof source.baseUrl === 'string' ? source.baseUrl.trim() : '';
  const searchPath = normalizePath(source.searchPath);
  const detailPath = normalizePath(source.detailPath);

  if (!id || !SOURCE_ID_PATTERN.test(id) || !name || !baseUrl || searchPath === null || detailPath === null) {
    return null;
  }

  const normalizedBaseUrl = (await assertOutboundUrlAllowed(baseUrl)).toString();
  const headers = sanitizeHeaderMap(source.headers);

  return {
    id,
    name,
    baseUrl: normalizedBaseUrl,
    searchPath,
    detailPath,
    headers,
    enabled: source.enabled !== false,
    priority: typeof source.priority === 'number' && Number.isFinite(source.priority) ? source.priority : 0,
    group: source.group === 'premium' ? 'premium' : 'normal',
  };
}

export async function buildSourceConfigMap(rawValue: unknown, limit: number = 50): Promise<Map<string, VideoSource>> {
  const sources = new Map<string, VideoSource>();
  if (!Array.isArray(rawValue)) {
    return sources;
  }

  for (const entry of rawValue.slice(0, limit)) {
    const source = await normalizeSourceConfig(entry);
    if (source) {
      sources.set(source.id, source);
    }
  }

  return sources;
}

export async function normalizeSourceConfigList(rawValue: unknown, limit: number = 50): Promise<VideoSource[]> {
  return Array.from((await buildSourceConfigMap(rawValue, limit)).values());
}

export function buildSourceEndpointUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}
