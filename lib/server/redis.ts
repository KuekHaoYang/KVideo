import { Redis } from '@upstash/redis/cloudflare';

import { getRuntimeEnvValue } from '@/lib/server/runtime-env';

let cachedRedis: Redis | undefined;

/**
 * Build the shared Upstash client from whichever environment source is available.
 *
 * `Redis.fromEnv()` is deliberately not used here: the `@upstash/redis/cloudflare`
 * implementation only reads Cloudflare's global bindings and never falls back to
 * `process.env`, so it always resolves to `undefined` on Docker / Node
 * self-hosted deployments. The client is also created lazily because Cloudflare's
 * per-request bindings are not reachable while a module is being evaluated.
 *
 * Returns `null` when Upstash is not configured, which callers should treat as
 * "server-side sync unavailable" rather than as a request failure.
 */
export function getRedisClient(): Redis | null {
  if (cachedRedis) {
    return cachedRedis;
  }

  const url = getRuntimeEnvValue('UPSTASH_REDIS_REST_URL');
  const token = getRuntimeEnvValue('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) {
    return null;
  }

  cachedRedis = new Redis({
    url,
    token,
  });
  return cachedRedis;
}
