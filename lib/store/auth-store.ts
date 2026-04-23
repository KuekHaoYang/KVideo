/**
 * Auth Store - Simple module-level session management
 * NOT Zustand — needs to stay synchronous for profiled storage keys.
 */

import {
  hasResolvedPermission,
  hasRoleAtLeast,
  normalizePermissions,
  normalizeRole,
  type Permission,
  type Role,
} from '@/lib/auth/permissions';

export type { Permission, Role } from '@/lib/auth/permissions';

export interface AuthSession {
  accountId: string;
  profileId: string;
  username?: string;
  name: string;
  role: Role;
  customPermissions?: Permission[];
  mode?: 'managed' | 'legacy';
}

const SESSION_KEY = 'kvideo-session';

function isValidSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AuthSession>;
  return typeof session.accountId === 'string' &&
    typeof session.profileId === 'string' &&
    typeof session.name === 'string' &&
    typeof session.role === 'string';
}

function notifySessionChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('kvideo-session-changed'));
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!isValidSession(parsed)) return null;

    return {
      accountId: parsed.accountId,
      profileId: parsed.profileId,
      username: typeof parsed.username === 'string' ? parsed.username : undefined,
      name: parsed.name,
      role: normalizeRole(parsed.role),
      customPermissions: normalizePermissions(parsed.customPermissions),
      mode: parsed.mode === 'managed' ? 'managed' : parsed.mode === 'legacy' ? 'legacy' : undefined,
    };
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession, persist: boolean): void {
  if (typeof window === 'undefined') return;
  const data = JSON.stringify({
    accountId: session.accountId,
    profileId: session.profileId,
    username: session.username,
    name: session.name,
    role: normalizeRole(session.role),
    customPermissions: normalizePermissions(session.customPermissions),
    mode: session.mode,
  });

  sessionStorage.setItem(SESSION_KEY, data);
  if (persist) {
    localStorage.setItem(SESSION_KEY, data);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }

  notifySessionChange();
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('kvideo_search_cache');
  sessionStorage.removeItem('kvideo-unlocked');
  localStorage.removeItem('kvideo-unlocked');
  notifySessionChange();
}

export function isAdmin(): boolean {
  const session = getSession();
  if (!session) return true;
  return session.role === 'admin' || session.role === 'super_admin';
}

export function hasPermission(permission: Permission): boolean {
  const session = getSession();
  if (!session) return true;
  return hasResolvedPermission(session.role, permission, session.customPermissions);
}

export function hasRole(minimumRole: Role): boolean {
  const session = getSession();
  if (!session) return true;
  return hasRoleAtLeast(session.role, minimumRole);
}

export function getProfileId(): string {
  return getSession()?.profileId || '';
}
