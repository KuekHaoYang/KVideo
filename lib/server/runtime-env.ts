import { getOptionalRequestContext } from '@cloudflare/next-on-pages';

/**
 * Read an environment value that may live in either runtime environment.
 *
 * On Cloudflare, bindings and secrets are only reachable through the
 * per-request context. On Docker / Node self-hosting there is no such context,
 * so the value comes from `process.env`.
 */
export function getRuntimeEnvValue(name: string, fallback = ''): string {
  try {
    const runtimeEnv = getOptionalRequestContext()?.env as unknown as Record<string, unknown> | undefined;
    const value = runtimeEnv?.[name];
    if (typeof value === 'string') return value;
  } catch {
    // Outside Cloudflare's request runtime, fall back to process.env.
  }

  return typeof process !== 'undefined' ? process.env[name] || fallback : fallback;
}
