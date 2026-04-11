import { getProfileId } from '@/lib/store/auth-store';

/**
 * Returns a profiled localStorage key based on the current user's profileId.
 * If no session exists, returns the base key unchanged (backward compatible).
 */
export function profiledKey(baseKey: string): string {
  const id = getProfileId();
  return id ? `${baseKey}-p-${id}` : baseKey;
}
