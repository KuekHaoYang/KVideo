import 'server-only';

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

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

const IPV4_BLOCKLIST = new BlockList();
const IPV6_BLOCKLIST = new BlockList();
const MAX_REDIRECTS = 5;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_REFERER_LENGTH = 2048;
const ALLOWLIST_ENV_KEY = 'KVIDEO_OUTBOUND_PRIVATE_HOST_ALLOWLIST';
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
const IPV4_MAPPED_IPV6_PREFIX = '::ffff:';

IPV4_BLOCKLIST.addSubnet('0.0.0.0', 8);
IPV4_BLOCKLIST.addSubnet('10.0.0.0', 8);
IPV4_BLOCKLIST.addSubnet('100.64.0.0', 10);
IPV4_BLOCKLIST.addSubnet('127.0.0.0', 8);
IPV4_BLOCKLIST.addSubnet('169.254.0.0', 16);
IPV4_BLOCKLIST.addSubnet('172.16.0.0', 12);
IPV4_BLOCKLIST.addSubnet('192.0.0.0', 24);
IPV4_BLOCKLIST.addSubnet('192.0.2.0', 24);
IPV4_BLOCKLIST.addSubnet('192.88.99.0', 24);
IPV4_BLOCKLIST.addSubnet('192.168.0.0', 16);
IPV4_BLOCKLIST.addSubnet('198.18.0.0', 15);
IPV4_BLOCKLIST.addSubnet('198.51.100.0', 24);
IPV4_BLOCKLIST.addSubnet('203.0.113.0', 24);
IPV4_BLOCKLIST.addSubnet('224.0.0.0', 4);

IPV6_BLOCKLIST.addSubnet('::', 128, 'ipv6');
IPV6_BLOCKLIST.addSubnet('::1', 128, 'ipv6');
IPV6_BLOCKLIST.addSubnet('fc00::', 7, 'ipv6');
IPV6_BLOCKLIST.addSubnet('fe80::', 10, 'ipv6');
IPV6_BLOCKLIST.addSubnet('ff00::', 8, 'ipv6');
IPV6_BLOCKLIST.addSubnet('2001:db8::', 32, 'ipv6');

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
  const type = isIP(normalized);

  if (type === 4) {
    return IPV4_BLOCKLIST.check(normalized, 'ipv4');
  }

  if (type === 6) {
    if (normalized.startsWith(IPV4_MAPPED_IPV6_PREFIX)) {
      return isPrivateIpAddress(normalized.slice(IPV4_MAPPED_IPV6_PREFIX.length));
    }

    return IPV6_BLOCKLIST.check(normalized, 'ipv6');
  }

  return false;
}

async function resolveHostAddresses(hostname: string): Promise<string[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => result.address);
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
  const hostIpType = isIP(hostname);

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
