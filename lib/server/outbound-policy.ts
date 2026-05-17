import 'server-only';

export class OutboundPolicyError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = 'OUTBOUND_REQUEST_REJECTED',
  ) {
    super(message);
    this.name = 'OutboundPolicyError';
  }
}

const MAX_REDIRECTS = 5;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_REFERER_LENGTH = 2048;
const ALLOWLIST_ENV_KEY = 'KVIDEO_OUTBOUND_PRIVATE_HOST_ALLOWLIST';
const DNS_OVER_HTTPS_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const DNS_CACHE_TTL_MS = 5 * 60 * 1000;
const DISALLOWED_HEADER_NAMES = new Set([
  'connection',
  'client-ip',
  'content-length',
  'cookie',
  'forwarded',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'set-cookie',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
]);
const BLOCKED_HOSTNAMES = new Set(['localhost']);
const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];
const hostnameResolutionCache = new Map<string, { addresses: string[]; expiresAt: number }>();
const IPV4_RESERVED_RANGES = [
  { base: '0.0.0.0', prefix: 8 },
  { base: '10.0.0.0', prefix: 8 },
  { base: '100.64.0.0', prefix: 10 },
  { base: '127.0.0.0', prefix: 8 },
  { base: '169.254.0.0', prefix: 16 },
  { base: '172.16.0.0', prefix: 12 },
  { base: '192.0.0.0', prefix: 24 },
  { base: '192.0.2.0', prefix: 24 },
  { base: '192.88.99.0', prefix: 24 },
  { base: '192.168.0.0', prefix: 16 },
  { base: '198.18.0.0', prefix: 15 },
  { base: '198.51.100.0', prefix: 24 },
  { base: '203.0.113.0', prefix: 24 },
  { base: '224.0.0.0', prefix: 4 },
].map(({ base, prefix }) => ({
  base: ipv4PartsToNumber(parseIpv4Parts(base)!),
  prefix,
}));

type IpAddressType = 0 | 4 | 6;

function parseIpv4Parts(address: string): number[] | null {
  const parts = address.split('.');

  if (parts.length !== 4) {
    return null;
  }

  const parsed = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      return Number.NaN;
    }

    return Number(part);
  });

  return parsed.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parsed : null;
}

function ipv4PartsToNumber(parts: number[]): number {
  return (
    (((parts[0] << 24) >>> 0) |
      (parts[1] << 16) |
      (parts[2] << 8) |
      parts[3]) >>>
    0
  );
}

function parseIpv6Segments(address: string): number[] | null {
  let normalized = address.toLowerCase();
  const zoneIndex = normalized.indexOf('%');
  if (zoneIndex >= 0) {
    normalized = normalized.slice(0, zoneIndex);
  }

  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    if (lastColon === -1) {
      return null;
    }

    const ipv4Parts = parseIpv4Parts(normalized.slice(lastColon + 1));
    if (!ipv4Parts) {
      return null;
    }

    normalized = [
      normalized.slice(0, lastColon),
      ((ipv4Parts[0] << 8) | ipv4Parts[1]).toString(16),
      ((ipv4Parts[2] << 8) | ipv4Parts[3]).toString(16),
    ].join(':');
  }

  const halves = normalized.split('::');
  if (halves.length > 2) {
    return null;
  }

  const parseHalf = (value: string): number[] | null => {
    if (!value) {
      return [];
    }

    const groups = value.split(':');
    const parsed = groups.map((group) => {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) {
        return Number.NaN;
      }

      return Number.parseInt(group, 16);
    });

    return parsed.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff)
      ? parsed
      : null;
  };

  const left = parseHalf(halves[0] || '');
  const right = parseHalf(halves[1] || '');

  if (!left || !right) {
    return null;
  }

  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }

  const missing = 8 - (left.length + right.length);
  if (missing < 1) {
    return null;
  }

  return [...left, ...Array(missing).fill(0), ...right];
}

function getIpAddressType(address: string): IpAddressType {
  if (parseIpv4Parts(address)) {
    return 4;
  }

  return parseIpv6Segments(address) ? 6 : 0;
}

function isIpv4PrefixMatch(address: number, base: number, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return (address & mask) === (base & mask);
}

function isReservedIpv4Address(address: string): boolean {
  const parts = parseIpv4Parts(address);
  if (!parts) {
    return false;
  }

  const value = ipv4PartsToNumber(parts);
  return IPV4_RESERVED_RANGES.some((range) => isIpv4PrefixMatch(value, range.base, range.prefix));
}

function getMappedIpv4Address(segments: number[]): string | null {
  const hasMappedPrefix = segments.slice(0, 5).every((segment) => segment === 0) && segments[5] === 0xffff;
  if (!hasMappedPrefix) {
    return null;
  }

  const high = segments[6];
  const low = segments[7];
  return [
    high >> 8,
    high & 0xff,
    low >> 8,
    low & 0xff,
  ].join('.');
}

function isReservedIpv6Address(address: string): boolean {
  const segments = parseIpv6Segments(address);
  if (!segments) {
    return false;
  }

  const mappedIpv4 = getMappedIpv4Address(segments);
  if (mappedIpv4) {
    return isReservedIpv4Address(mappedIpv4);
  }

  if (segments.every((segment) => segment === 0)) {
    return true;
  }

  if (segments.slice(0, 7).every((segment) => segment === 0) && segments[7] === 1) {
    return true;
  }

  const first = segments[0];
  const second = segments[1];

  return (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && second === 0x0db8)
  );
}

export interface OutboundValidationOptions {
  allowPrivateHosts?: boolean;
}

function getPrivateHostAllowlist(): Set<string> {
  return new Set(
    (process.env[ALLOWLIST_ENV_KEY] || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().replace(/\.$/, '').toLowerCase();
}

function isAllowlistedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  const allowlist = getPrivateHostAllowlist();

  for (const entry of allowlist) {
    if (normalized === entry || normalized.endsWith(`.${entry}`)) {
      return true;
    }
  }

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);

  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }

  if (!normalized.includes('.')) {
    return true;
  }

  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isPrivateIpAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  const type = getIpAddressType(normalized);

  return type === 4 ? isReservedIpv4Address(normalized) : type === 6 ? isReservedIpv6Address(normalized) : false;
}

interface DnsJsonResponse {
  Answer?: Array<{ data?: string }>;
}

async function resolveViaDnsOverHttps(hostname: string, type: 'A' | 'AAAA'): Promise<string[]> {
  const dnsUrl = new URL(DNS_OVER_HTTPS_ENDPOINT);
  dnsUrl.searchParams.set('name', hostname);
  dnsUrl.searchParams.set('type', type);

  const response = await fetch(dnsUrl, {
    headers: {
      accept: 'application/dns-json',
    },
    redirect: 'manual',
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as DnsJsonResponse;
  if (!Array.isArray(payload.Answer)) {
    return [];
  }

  return payload.Answer
    .map((answer) => answer.data?.trim() || '')
    .filter((answer) => getIpAddressType(answer) > 0);
}

async function resolveHostAddresses(hostname: string): Promise<string[]> {
  const cached = hostnameResolutionCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.addresses;
  }

  const [ipv4Addresses, ipv6Addresses] = await Promise.all([
    resolveViaDnsOverHttps(hostname, 'A'),
    resolveViaDnsOverHttps(hostname, 'AAAA'),
  ]);

  const addresses = [...new Set([...ipv4Addresses, ...ipv6Addresses])];
  hostnameResolutionCache.set(hostname, {
    addresses,
    expiresAt: Date.now() + DNS_CACHE_TTL_MS,
  });
  return addresses;
}

export async function assertOutboundUrlAllowed(
  rawUrl: string | URL,
  options: OutboundValidationOptions = {},
): Promise<URL> {
  let parsedUrl: URL;

  try {
    parsedUrl = rawUrl instanceof URL ? new URL(rawUrl.toString()) : new URL(rawUrl);
  } catch {
    throw new OutboundPolicyError('Invalid outbound URL', 400, 'INVALID_OUTBOUND_URL');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new OutboundPolicyError('Only HTTP(S) outbound URLs are allowed', 400, 'UNSUPPORTED_OUTBOUND_PROTOCOL');
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new OutboundPolicyError('Outbound URLs must not include credentials', 400, 'OUTBOUND_URL_HAS_CREDENTIALS');
  }

  const hostname = normalizeHostname(parsedUrl.hostname);
  const allowlistedHost = isAllowlistedHostname(hostname);
  const allowPrivate = options.allowPrivateHosts === true || allowlistedHost;
  const hostIpType = getIpAddressType(hostname);

  if (hostIpType > 0) {
    if (!allowPrivate && isPrivateIpAddress(hostname)) {
      throw new OutboundPolicyError('Outbound target resolves to a private or reserved IP address', 403, 'PRIVATE_OUTBOUND_TARGET');
    }

    return parsedUrl;
  }

  if (!allowPrivate && isBlockedHostname(hostname)) {
    throw new OutboundPolicyError('Outbound target hostname is not allowed', 403, 'BLOCKED_OUTBOUND_HOSTNAME');
  }

  const resolvedAddresses = await resolveHostAddresses(hostname);
  if (resolvedAddresses.length === 0) {
    throw new OutboundPolicyError('Outbound target hostname did not resolve', 400, 'UNRESOLVED_OUTBOUND_HOSTNAME');
  }

  if (!allowPrivate && resolvedAddresses.some((address) => isPrivateIpAddress(address))) {
    throw new OutboundPolicyError('Outbound target resolves to a private or reserved IP address', 403, 'PRIVATE_OUTBOUND_TARGET');
  }

  return parsedUrl;
}

function sanitizeRedirectHeaders(init: RequestInit): RequestInit {
  const method = (init.method || 'GET').toUpperCase();
  return method === 'GET' || method === 'HEAD'
    ? init
    : {
        ...init,
        body: undefined,
        method: 'GET',
      };
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export async function fetchWithPolicy(
  input: string | URL,
  init: RequestInit = {},
  options: OutboundValidationOptions = {},
): Promise<Response> {
  let currentUrl = await assertOutboundUrlAllowed(input, options);
  let requestInit: RequestInit = { ...init, redirect: 'manual' };

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, requestInit);

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      return response;
    }

    if (redirectCount === MAX_REDIRECTS) {
      throw new OutboundPolicyError('Too many outbound redirects', 502, 'OUTBOUND_REDIRECT_LIMIT');
    }

    currentUrl = await assertOutboundUrlAllowed(new URL(location, currentUrl), options);
    requestInit = sanitizeRedirectHeaders(requestInit);
  }

  throw new OutboundPolicyError('Too many outbound redirects', 502, 'OUTBOUND_REDIRECT_LIMIT');
}

export function sanitizeHeaderMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const sanitized: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== 'string') {
      continue;
    }

    const key = rawKey.trim();
    const lowerKey = key.toLowerCase();
    const trimmedValue = rawValue.trim();

    if (!key || !trimmedValue || DISALLOWED_HEADER_NAMES.has(lowerKey)) {
      continue;
    }

    sanitized[key] = trimmedValue;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function sanitizeUserAgent(rawValue: string | null): string | undefined {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, MAX_USER_AGENT_LENGTH);
}

export async function sanitizeReferer(rawValue: string | null): Promise<string | undefined> {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return undefined;
  }

  const refererUrl = await assertOutboundUrlAllowed(trimmed);
  return refererUrl.toString().slice(0, MAX_REFERER_LENGTH);
}

export function getRelayForwardHeaders(request: Request, extraHeaders: Record<string, string> = {}): Headers {
  const headers = new Headers();
  const range = request.headers.get('range');

  if (range) {
    headers.set('Range', range);
  }

  for (const [key, value] of Object.entries(extraHeaders)) {
    if (!value) {
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}
