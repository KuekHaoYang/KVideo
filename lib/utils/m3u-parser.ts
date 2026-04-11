/**
 * M3U Playlist Parser
 * Parses M3U/M3U8 IPTV playlist format and JSON channel lists
 */

export interface M3UChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgName?: string;
  routes?: string[];
  sourceId?: string;
  sourceName?: string;
  httpUserAgent?: string;
  httpReferrer?: string;
}

export interface M3UPlaylist {
  channels: M3UChannel[];
  groups: string[];
}

export interface PlaylistReference {
  kind: 'playlist' | 'config';
  name: string;
  url: string;
  httpUserAgent?: string;
  httpReferrer?: string;
}

const STREAM_URL_RE = /^(https?:\/\/|rtmp:\/\/|rtsp:\/\/|udp:\/\/|rtp:\/\/|mms:\/\/|ftp:\/\/|file:\/\/|\/\/)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function unwrapProxyUrl(target: string): string {
  const trimmed = target.trim();
  if (!trimmed.startsWith('proxy://')) {
    return trimmed;
  }

  const match = trimmed.match(/(?:^|[?&])(?:ext|url)=([^&]+)/i);
  if (!match) {
    return trimmed;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function looksLikeRelativeMediaPath(value: string): boolean {
  return value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.endsWith('.m3u8') ||
    value.endsWith('.m3u') ||
    value.includes('.m3u8?') ||
    value.includes('.mp4');
}

function resolveReferenceUrl(baseUrl: string | undefined, target: string): string {
  const normalizedTarget = unwrapProxyUrl(target);
  if (!baseUrl) return normalizedTarget;
  try {
    return new URL(normalizedTarget, baseUrl).toString();
  } catch {
    return normalizedTarget;
  }
}

function countStreamMatches(value: string): number {
  const matches = value.match(/(?:https?:\/\/|rtmp:\/\/|rtsp:\/\/|udp:\/\/|rtp:\/\/|mms:\/\/|ftp:\/\/|file:\/\/|\/\/)/gi);
  return matches ? matches.length : 0;
}

function normalizeRouteCandidate(rawValue: string): string | null {
  const trimmed = unwrapProxyUrl(rawValue);
  if (!trimmed) {
    return null;
  }

  const fromDollar = trimmed.includes('$') ? trimmed.slice(trimmed.lastIndexOf('$') + 1).trim() : trimmed;
  if (STREAM_URL_RE.test(fromDollar) || looksLikeRelativeMediaPath(fromDollar)) {
    return fromDollar;
  }

  const fromComma = fromDollar.includes(',') ? fromDollar.slice(fromDollar.lastIndexOf(',') + 1).trim() : fromDollar;
  if (STREAM_URL_RE.test(fromComma) || looksLikeRelativeMediaPath(fromComma)) {
    return fromComma;
  }

  return STREAM_URL_RE.test(trimmed) || looksLikeRelativeMediaPath(trimmed) ? trimmed : null;
}

function extractRoutes(value: unknown, baseUrl?: string): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(
      value.flatMap((item) => extractRoutes(item, baseUrl))
    ));
  }

  if (typeof value !== 'string') {
    if (isRecord(value)) {
      return extractRoutes(firstString(value.url, value.src, value.link), baseUrl);
    }
    return [];
  }

  const segments = value
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((segment) => (
      segment.includes('#') && countStreamMatches(segment) > 1
        ? segment.split('#').map((part) => part.trim()).filter(Boolean)
        : [segment]
    ));

  return Array.from(new Set(
    segments
      .map(normalizeRouteCandidate)
      .filter((route): route is string => !!route)
      .map((route) => resolveReferenceUrl(baseUrl, route))
  ));
}

function buildChannel(entry: Record<string, unknown>, baseUrl?: string, inheritedGroup?: string): M3UChannel | null {
  const name = firstString(
    entry.name,
    entry.title,
    entry.channel_name,
    entry.channel,
    entry.tvg_name,
    entry.tvgName
  );
  const routes = extractRoutes(
    entry.urls ?? entry.url ?? entry.stream_url ?? entry.src ?? entry.link ?? entry.stream ?? entry.playUrl ?? entry.play_url,
    baseUrl
  );

  if (!name || routes.length === 0) {
    return null;
  }

  const group = firstString(entry.group, entry.group_title, entry.groupName, entry.category, inheritedGroup);
  const channel: M3UChannel = {
    name,
    url: routes[0],
    logo: firstString(entry.logo, entry.icon, entry.tvg_logo),
    group,
    tvgId: firstString(entry.tvg_id, entry.tvgId),
    tvgName: firstString(entry.tvg_name, entry.tvgName),
    httpUserAgent: firstString(entry.http_user_agent, entry.httpUserAgent, entry.user_agent, entry.userAgent, entry.ua),
    httpReferrer: firstString(entry.http_referrer, entry.httpReferrer, entry.referer, entry.referrer),
  };

  if (routes.length > 1) {
    channel.routes = routes;
  }

  return channel;
}

function getJsonChannelEntries(data: unknown): Array<{ entry: Record<string, unknown>; inheritedGroup?: string }> {
  if (Array.isArray(data)) {
    return data.filter(isRecord).map((entry) => ({ entry }));
  }

  if (!isRecord(data)) {
    return [];
  }

  for (const candidate of [data.channels, data.list, data.items, data.data]) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord).map((entry) => ({ entry }));
    }
  }

  if (Array.isArray(data.lives)) {
    const nestedChannels: Array<{ entry: Record<string, unknown>; inheritedGroup?: string }> = [];

    for (const liveEntry of data.lives) {
      if (!isRecord(liveEntry) || !Array.isArray(liveEntry.channels)) {
        continue;
      }

      const inheritedGroup = firstString(
        liveEntry.group,
        liveEntry.group_title,
        liveEntry.groupName,
        liveEntry.name,
        liveEntry.title
      );

      for (const channelEntry of liveEntry.channels) {
        if (isRecord(channelEntry)) {
          nestedChannels.push({ entry: channelEntry, inheritedGroup });
        }
      }
    }

    if (nestedChannels.length > 0) {
      return nestedChannels;
    }
  }

  return [];
}

function getReferenceTargets(entry: Record<string, unknown>): string[] {
  const directUrl = firstString(entry.url);
  if (directUrl) {
    return [directUrl];
  }

  if (Array.isArray(entry.urls)) {
    return entry.urls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }

  return [];
}

export function extractPlaylistReferences(content: string, baseUrl?: string): PlaylistReference[] {
  try {
    const data = JSON.parse(content);
    if (!isRecord(data)) return [];
    const parsedData = data as Record<string, unknown>;

    const references: PlaylistReference[] = [];

    if (Array.isArray(parsedData.lives)) {
      for (const entry of parsedData.lives) {
        if (!isRecord(entry) || Array.isArray(entry.channels)) continue;
        const targets = getReferenceTargets(entry);
        for (const target of targets) {
          references.push({
            kind: 'playlist',
            name: firstString(entry.name, entry.title) || '直播源',
            url: resolveReferenceUrl(baseUrl, target),
            httpUserAgent: firstString(entry.ua, entry.userAgent, entry.http_user_agent, entry.httpUserAgent),
            httpReferrer: firstString(entry.referer, entry.referrer, entry.http_referrer, entry.httpReferrer),
          });
        }
      }
    }

    if (Array.isArray(parsedData.urls)) {
      for (const entry of parsedData.urls) {
        if (!isRecord(entry)) continue;
        const targets = getReferenceTargets(entry);
        for (const target of targets) {
          references.push({
            kind: 'config',
            name: firstString(entry.name, entry.title) || '配置源',
            url: resolveReferenceUrl(baseUrl, target),
          });
        }
      }
    }

    return references;
  } catch {
    return [];
  }
}

/**
 * Try to parse content as JSON channel list.
 * Supports formats:
 * - Array of channel objects: [{ name, url, group?, logo?, ... }]
 * - Object with channels/list field: { channels: [...] } or { list: [...] }
 * - TVBox/OK-style lives groups with nested channels arrays
 */
function tryParseJSON(content: string, baseUrl?: string): M3UPlaylist | null {
  try {
    const data = JSON.parse(content);
    const entries = getJsonChannelEntries(data);

    const groupSet = new Set<string>();
    const parsed: M3UChannel[] = [];

    for (const { entry, inheritedGroup } of entries) {
      const channel = buildChannel(entry, baseUrl, inheritedGroup);
      if (!channel) continue;

      if (channel.group) {
        groupSet.add(channel.group);
      }

      parsed.push(channel);
    }

    if (parsed.length === 0) return null;

    return {
      channels: parsed,
      groups: Array.from(groupSet).sort(),
    };
  } catch {
    return null;
  }
}

/**
 * Parse M3U playlist content into structured data.
 * Also supports JSON format channel lists.
 */
export function parseM3U(content: string, baseUrl?: string): M3UPlaylist {
  const trimmed = content.trim();

  // Try JSON first if it looks like JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const jsonResult = tryParseJSON(trimmed, baseUrl);
    if (jsonResult) return jsonResult;
  }

  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const channels: M3UChannel[] = [];
  const groupSet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF:')) {
      // Parse EXTINF line
      const channel: M3UChannel = { name: '', url: '' };

      // Extract attributes from EXTINF
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/i);
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
      const httpUserAgentMatch = line.match(/http-user-agent="([^"]*)"/i);
      const httpReferrerMatch = line.match(/http-referrer="([^"]*)"/i);

      if (tvgNameMatch) channel.tvgName = tvgNameMatch[1];
      if (tvgLogoMatch) channel.logo = tvgLogoMatch[1];
      if (groupTitleMatch) {
        channel.group = groupTitleMatch[1];
        if (channel.group) groupSet.add(channel.group);
      }
      if (tvgIdMatch) channel.tvgId = tvgIdMatch[1];
      if (httpUserAgentMatch) channel.httpUserAgent = httpUserAgentMatch[1];
      if (httpReferrerMatch) channel.httpReferrer = httpReferrerMatch[1];

      // Extract channel name (after last comma)
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        channel.name = line.substring(commaIndex + 1).trim();
      }

      // Next non-comment line should be the URL
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].startsWith('#')) {
          channel.url = resolveReferenceUrl(baseUrl, lines[j]);
          i = j; // Skip to after URL
          break;
        }
      }

      if (channel.name && channel.url) {
        // Use tvgName as fallback for name
        if (!channel.name && channel.tvgName) {
          channel.name = channel.tvgName;
        }
        channels.push(channel);
      }
    }
  }

  // If no EXTINF entries were found, also try JSON as a fallback
  if (channels.length === 0) {
    const jsonResult = tryParseJSON(content, baseUrl);
    if (jsonResult) return jsonResult;
  }

  return {
    channels,
    groups: Array.from(groupSet).sort(),
  };
}

/**
 * Group channels with the same name into single entries with multiple routes.
 * This merges duplicate channel names (common in M3U playlists with multiple streams).
 */
export function groupChannelsByName(channels: M3UChannel[]): M3UChannel[] {
  const groups = new Map<string, M3UChannel>();

  for (const ch of channels) {
    const key = `${ch.sourceId || ''}::${ch.name.toLowerCase().trim()}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.routes) {
        existing.routes = [existing.url];
      }
      if (!existing.routes.includes(ch.url)) {
        existing.routes.push(ch.url);
      }
      // Use first logo found
      if (!existing.logo && ch.logo) existing.logo = ch.logo;
    } else {
      groups.set(key, { ...ch });
    }
  }

  // Only add routes array when there are multiple routes
  const result = Array.from(groups.values());
  for (const ch of result) {
    if (ch.routes && ch.routes.length <= 1) {
      delete ch.routes;
    }
  }
  return result;
}
