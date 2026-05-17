import 'server-only';

import { NextRequest } from 'next/server';
import { normalizeUsername } from '@/lib/server/auth-helpers';
import { getRedisClient } from '@/lib/server/redis-client';

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_ACCOUNT = 5;

interface MemoryEntry {
  count: number;
  expiresAt: number;
}

const memoryCounters = new Map<string, MemoryEntry>();

function getClientAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function buildCounterKeys(request: NextRequest, username?: string | null, scope: string = 'login'): string[] {
  const keys = [`auth:throttle:${scope}:ip:${getClientAddress(request)}`];
  const normalizedUsername = username ? normalizeUsername(username) : '';
  if (normalizedUsername) {
    keys.push(`auth:throttle:${scope}:user:${normalizedUsername}`);
  }
  return keys;
}

function pruneMemoryEntry(key: string): MemoryEntry | undefined {
  const current = memoryCounters.get(key);
  if (!current) {
    return undefined;
  }

  if (current.expiresAt <= Date.now()) {
    memoryCounters.delete(key);
    return undefined;
  }

  return current;
}

async function readCounterState(key: string): Promise<{ count: number; retryAfterSeconds: number }> {
  const redis = getRedisClient();
  if (redis) {
    const [countValue, ttlValue] = await Promise.all([redis.get<number>(key), redis.ttl(key)]);
    return {
      count: typeof countValue === 'number' ? countValue : 0,
      retryAfterSeconds: typeof ttlValue === 'number' && ttlValue > 0 ? ttlValue : WINDOW_SECONDS,
    };
  }

  const entry = pruneMemoryEntry(key);
  return {
    count: entry?.count || 0,
    retryAfterSeconds: entry ? Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000)) : WINDOW_SECONDS,
  };
}

async function incrementCounter(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    return;
  }

  const entry = pruneMemoryEntry(key);
  if (!entry) {
    memoryCounters.set(key, { count: 1, expiresAt: Date.now() + WINDOW_SECONDS * 1000 });
    return;
  }

  memoryCounters.set(key, { count: entry.count + 1, expiresAt: entry.expiresAt });
}

async function clearCounter(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.del(key);
    return;
  }

  memoryCounters.delete(key);
}

export async function getAuthThrottleStatus(
  request: NextRequest,
  username?: string | null,
  scope: string = 'login',
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const keys = buildCounterKeys(request, username, scope);
  let blocked = false;
  let retryAfterSeconds = 0;

  for (const key of keys) {
    const state = await readCounterState(key);
    const limit = key.includes(':user:') ? MAX_ATTEMPTS_PER_ACCOUNT : MAX_ATTEMPTS_PER_IP;

    if (state.count >= limit) {
      blocked = true;
      retryAfterSeconds = Math.max(retryAfterSeconds, state.retryAfterSeconds);
    }
  }

  return { blocked, retryAfterSeconds: retryAfterSeconds || WINDOW_SECONDS };
}

export async function recordAuthFailure(
  request: NextRequest,
  username?: string | null,
  scope: string = 'login',
): Promise<void> {
  const keys = buildCounterKeys(request, username, scope);
  await Promise.all(keys.map((key) => incrementCounter(key)));
}

export async function clearAuthFailures(
  request: NextRequest,
  username?: string | null,
  scope: string = 'login',
): Promise<void> {
  const keys = buildCounterKeys(request, username, scope);
  await Promise.all(keys.map((key) => clearCounter(key)));
}
