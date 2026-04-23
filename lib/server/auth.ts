import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeFeatures } from '@/lib/server/runtime-features';
import {
  createStoredAccount,
  ensureUniqueUsername,
  hashPassword,
  normalizeUsername,
  parseBootstrapAccounts,
  signSessionPayload,
  verifyPassword,
  verifySessionToken,
  type SeedAccountInput,
  type SessionPayload,
  type StoredAccountRecord,
} from '@/lib/server/auth-helpers';
import {
  hasResolvedPermission,
  normalizePermissions,
  normalizeRole,
  type Permission,
  type Role,
} from '@/lib/auth/permissions';

export type LoginMode = 'none' | 'legacy_password' | 'managed';

export interface ServerAuthSession {
  accountId: string;
  profileId: string;
  username?: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
  mode: 'managed' | 'legacy';
  iat: number;
}

export interface PublicAuthConfig {
  hasAuth: boolean;
  hasPremiumAuth: boolean;
  loginMode: LoginMode;
  persistSession: boolean;
  subscriptionSources: string;
  iptvSources: string;
  mergeSources: string;
  danmakuApiUrl: string;
}

export interface PublicSessionData {
  accountId: string;
  profileId: string;
  username?: string;
  name: string;
  role: Role;
  customPermissions?: Permission[];
  mode: 'managed' | 'legacy';
}

export interface AccountInfo {
  id: string;
  username: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
  createdAt: number;
  updatedAt: number;
}

const SESSION_COOKIE_NAME = 'kvideo_session';
const MANAGED_ACCOUNTS_KEY = 'auth:accounts:v1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';
const ACCOUNTS = process.env.ACCOUNTS || '';
const AUTH_SECRET = process.env.AUTH_SECRET || '';
const PREMIUM_PASSWORD = process.env.PREMIUM_PASSWORD || '';
const PERSIST_SESSION = process.env.PERSIST_SESSION !== 'false';
const SUBSCRIPTION_SOURCES = process.env.SUBSCRIPTION_SOURCES || process.env.NEXT_PUBLIC_SUBSCRIPTION_SOURCES || '';
const IPTV_SOURCES = process.env.IPTV_SOURCES || process.env.NEXT_PUBLIC_IPTV_SOURCES || '';
const MERGE_SOURCES = process.env.MERGE_SOURCES || process.env.NEXT_PUBLIC_MERGE_SOURCES || '';
const DANMAKU_API_URL = process.env.DANMAKU_API_URL || process.env.NEXT_PUBLIC_DANMAKU_API_URL || '';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const effectiveAdminPassword = ADMIN_PASSWORD || ACCESS_PASSWORD;

let cachedRedis: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (cachedRedis !== undefined) {
    return cachedRedis;
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    cachedRedis = null;
    return cachedRedis;
  }

  cachedRedis = Redis.fromEnv();
  return cachedRedis;
}

function isManagedAuthEnabled(): boolean {
  return !!AUTH_SECRET && !!getRedisClient();
}

function isLegacyAuthConfigured(): boolean {
  return !!(effectiveAdminPassword || ACCOUNTS);
}

function isStoredAccountRecord(value: unknown): value is StoredAccountRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<StoredAccountRecord>;
  return typeof record.id === 'string' &&
    typeof record.username === 'string' &&
    typeof record.name === 'string' &&
    typeof record.passwordHash === 'string' &&
    typeof record.passwordSalt === 'string' &&
    typeof record.createdAt === 'number' &&
    typeof record.updatedAt === 'number';
}

function normalizeStoredAccount(value: StoredAccountRecord): StoredAccountRecord {
  return {
    ...value,
    username: normalizeUsername(value.username),
    role: normalizeRole(value.role),
    customPermissions: normalizePermissions(value.customPermissions),
  };
}

async function readManagedAccounts(): Promise<StoredAccountRecord[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  try {
    const stored = await redis.get(MANAGED_ACCOUNTS_KEY);
    if (!Array.isArray(stored)) return [];
    return stored.filter(isStoredAccountRecord).map(normalizeStoredAccount);
  } catch {
    return [];
  }
}

async function saveManagedAccounts(accounts: StoredAccountRecord[]): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Managed auth storage unavailable');
  }

  await redis.set(MANAGED_ACCOUNTS_KEY, accounts);
}

function getBootstrapSeeds(): SeedAccountInput[] {
  const seeds: SeedAccountInput[] = [];
  const usernames = new Set<string>();

  if (effectiveAdminPassword) {
    usernames.add('admin');
    seeds.push({
      username: 'admin',
      password: effectiveAdminPassword,
      name: '超级管理员',
      role: 'super_admin',
      customPermissions: [],
    });
  }

  for (const account of parseBootstrapAccounts(ACCOUNTS)) {
    const username = ensureUniqueUsername(account.username, usernames, account.name);
    usernames.add(username);
    seeds.push({ ...account, username });
  }

  return seeds;
}

async function ensureManagedAccountsBootstrapped(): Promise<StoredAccountRecord[]> {
  if (!isManagedAuthEnabled()) return [];

  const existing = await readManagedAccounts();
  if (existing.length > 0) {
    return existing;
  }

  const bootstrapSeeds = getBootstrapSeeds();
  if (bootstrapSeeds.length === 0) {
    return [];
  }

  const now = Date.now();
  const created = await Promise.all(
    bootstrapSeeds.map((seed, index) => createStoredAccount(seed, now + index))
  );
  await saveManagedAccounts(created);
  return created;
}

async function getManagedAccountCount(): Promise<number> {
  if (!isManagedAuthEnabled()) return 0;
  const existing = await readManagedAccounts();
  if (existing.length > 0) {
    return existing.length;
  }
  return getBootstrapSeeds().length;
}

function getPublicRuntimeConfig(): Omit<PublicAuthConfig, 'hasAuth' | 'hasPremiumAuth' | 'loginMode'> {
  const runtimeFeatures = getRuntimeFeatures();

  return {
    persistSession: PERSIST_SESSION,
    subscriptionSources: SUBSCRIPTION_SOURCES,
    iptvSources: runtimeFeatures.iptvEnabled ? IPTV_SOURCES : '',
    mergeSources: MERGE_SOURCES,
    danmakuApiUrl: DANMAKU_API_URL,
  };
}

export async function getPublicAuthConfig(): Promise<PublicAuthConfig> {
  const managedAccountCount = await getManagedAccountCount();
  const loginMode: LoginMode = managedAccountCount > 0
    ? 'managed'
    : isLegacyAuthConfigured()
      ? 'legacy_password'
      : 'none';

  return {
    hasAuth: loginMode !== 'none',
    hasPremiumAuth: !!PREMIUM_PASSWORD,
    loginMode,
    ...getPublicRuntimeConfig(),
  };
}

function buildLegacyProfileIdInput(password: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(`${password}kvideo-profile-salt-v1`);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function generateLegacyProfileId(password: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buildLegacyProfileIdInput(password));
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function resolveSessionSecret(loginMode: LoginMode): string | null {
  if (AUTH_SECRET) {
    return AUTH_SECRET;
  }

  if (loginMode === 'legacy_password' && isLegacyAuthConfigured()) {
    return `legacy:${effectiveAdminPassword}:${ACCOUNTS}:${PREMIUM_PASSWORD}`;
  }

  return null;
}

function sessionPayloadToServerSession(payload: SessionPayload): ServerAuthSession {
  return {
    accountId: payload.accountId,
    profileId: payload.profileId,
    username: payload.username,
    name: payload.name,
    role: payload.role,
    customPermissions: normalizePermissions(payload.customPermissions),
    mode: payload.mode,
    iat: payload.iat,
  };
}

export function toPublicSession(session: ServerAuthSession): PublicSessionData {
  return {
    accountId: session.accountId,
    profileId: session.profileId,
    username: session.username,
    name: session.name,
    role: session.role,
    customPermissions: session.customPermissions.length > 0 ? session.customPermissions : undefined,
    mode: session.mode,
  };
}

async function signSession(session: ServerAuthSession, loginMode: LoginMode): Promise<string | null> {
  const secret = resolveSessionSecret(loginMode);
  if (!secret) return null;

  return signSessionPayload(
    {
      accountId: session.accountId,
      profileId: session.profileId,
      username: session.username,
      name: session.name,
      role: session.role,
      customPermissions: session.customPermissions,
      mode: session.mode,
      iat: session.iat,
    },
    secret
  );
}

export async function getServerSession(request: NextRequest): Promise<ServerAuthSession | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const config = await getPublicAuthConfig();
  const secret = resolveSessionSecret(config.loginMode);
  if (!secret) return null;

  const payload = await verifySessionToken(token, secret);
  if (!payload) return null;

  return sessionPayloadToServerSession(payload);
}

function applySessionCookie(response: NextResponse, token: string, persist: boolean): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(persist ? { maxAge: SESSION_MAX_AGE_SECONDS } : {}),
  });
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export function hasServerPermission(session: ServerAuthSession, permission: Permission): boolean {
  return hasResolvedPermission(session.role, permission, session.customPermissions);
}

export function isSuperAdminSession(session: ServerAuthSession): boolean {
  return session.role === 'super_admin';
}

async function authenticateManagedLogin(username: string, password: string): Promise<ServerAuthSession | null> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !password) return null;

  const accounts = await ensureManagedAccountsBootstrapped();
  const account = accounts.find((item) => item.username === normalizedUsername);
  if (!account) return null;

  const valid = await verifyPassword(password, account.passwordSalt, account.passwordHash);
  if (!valid) return null;

  return {
    accountId: account.id,
    profileId: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
    customPermissions: account.customPermissions,
    mode: 'managed',
    iat: Date.now(),
  };
}

async function authenticateLegacyLogin(password: string): Promise<ServerAuthSession | null> {
  if (!password) return null;

  if (effectiveAdminPassword && password === effectiveAdminPassword) {
    return {
      accountId: 'legacy-admin',
      profileId: await generateLegacyProfileId(password),
      username: 'admin',
      name: '超级管理员',
      role: 'super_admin',
      customPermissions: [],
      mode: 'legacy',
      iat: Date.now(),
    };
  }

  for (const account of parseBootstrapAccounts(ACCOUNTS)) {
    if (account.password !== password) continue;
    return {
      accountId: `legacy:${account.username}`,
      profileId: await generateLegacyProfileId(password),
      username: account.username,
      name: account.name,
      role: account.role,
      customPermissions: account.customPermissions,
      mode: 'legacy',
      iat: Date.now(),
    };
  }

  return null;
}

export async function authenticateLogin(body: { username?: string; password?: string }): Promise<ServerAuthSession | null> {
  const config = await getPublicAuthConfig();
  if (config.loginMode === 'managed') {
    return authenticateManagedLogin(body.username || '', body.password || '');
  }

  if (config.loginMode === 'legacy_password') {
    return authenticateLegacyLogin(body.password || '');
  }

  return null;
}

async function authenticateManagedAdminCredential(username: string, password: string): Promise<boolean> {
  const session = await authenticateManagedLogin(username, password);
  return !!session && (session.role === 'super_admin' || session.role === 'admin');
}

async function authenticateLegacyAdminCredential(password: string): Promise<boolean> {
  const session = await authenticateLegacyLogin(password);
  return !!session && (session.role === 'super_admin' || session.role === 'admin');
}

export async function validatePremiumAccess(
  request: NextRequest,
  body: { username?: string; password?: string }
): Promise<boolean> {
  const session = await getServerSession(request);
  if (session && (session.role === 'super_admin' || session.role === 'admin')) {
    return true;
  }

  if (!PREMIUM_PASSWORD) {
    return true;
  }

  if (!body.password || typeof body.password !== 'string') {
    return false;
  }

  if (body.password === PREMIUM_PASSWORD) {
    return true;
  }

  const config = await getPublicAuthConfig();
  if (config.loginMode === 'managed') {
    if (!body.username) return false;
    return authenticateManagedAdminCredential(body.username, body.password);
  }

  return authenticateLegacyAdminCredential(body.password);
}

export async function createLoginResponse(session: ServerAuthSession): Promise<NextResponse> {
  const config = await getPublicAuthConfig();
  const token = await signSession(session, config.loginMode);
  if (!token) {
    return NextResponse.json({ valid: false, message: 'Session signing unavailable' }, { status: 500 });
  }

  const response = NextResponse.json({
    valid: true,
    session: toPublicSession(session),
    ...config,
  });

  applySessionCookie(response, token, PERSIST_SESSION);
  return response;
}

export async function createSessionStatusResponse(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(request);
  const config = await getPublicAuthConfig();

  return NextResponse.json({
    authenticated: !!session,
    session: session ? toPublicSession(session) : null,
    ...config,
  });
}

export function logoutResponse(): NextResponse {
  return clearSessionCookie(NextResponse.json({ success: true }));
}

export async function listAccountInfo(): Promise<AccountInfo[]> {
  const config = await getPublicAuthConfig();

  if (config.loginMode === 'managed') {
    const accounts = await ensureManagedAccountsBootstrapped();
    return accounts.map((account) => ({
      id: account.id,
      username: account.username,
      name: account.name,
      role: account.role,
      customPermissions: account.customPermissions,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));
  }

  const legacyAccounts: AccountInfo[] = [];
  let index = 0;

  if (effectiveAdminPassword) {
    legacyAccounts.push({
      id: 'legacy-admin',
      username: 'admin',
      name: '超级管理员',
      role: 'super_admin',
      customPermissions: [],
      createdAt: 0,
      updatedAt: 0,
    });
    index += 1;
  }

  for (const account of parseBootstrapAccounts(ACCOUNTS)) {
    legacyAccounts.push({
      id: `legacy-${index}`,
      username: account.username,
      name: account.name,
      role: account.role,
      customPermissions: account.customPermissions,
      createdAt: 0,
      updatedAt: 0,
    });
    index += 1;
  }

  return legacyAccounts;
}

function sanitizeAccountInput(body: unknown): {
  username?: string;
  name?: string;
  password?: string;
  role?: Role;
  customPermissions?: Permission[];
} {
  if (!body || typeof body !== 'object') return {};
  const input = body as Record<string, unknown>;

  return {
    username: typeof input.username === 'string' ? normalizeUsername(input.username) : undefined,
    name: typeof input.name === 'string' ? input.name.trim() : undefined,
    password: typeof input.password === 'string' ? input.password : undefined,
    role: typeof input.role === 'string' ? normalizeRole(input.role) : undefined,
    customPermissions: Array.isArray(input.customPermissions) ? normalizePermissions(input.customPermissions as string[]) : undefined,
  };
}

function ensureOneSuperAdmin(accounts: StoredAccountRecord[]): void {
  const count = accounts.filter((account) => account.role === 'super_admin').length;
  if (count === 0) {
    throw new Error('At least one super admin account is required');
  }
}

export async function createManagedAccount(body: unknown): Promise<AccountInfo> {
  if (!getRedisClient() || !isManagedAuthEnabled()) {
    throw new Error('Managed accounts unavailable');
  }

  const input = sanitizeAccountInput(body);
  if (!input.username || !input.name || !input.password || !input.role) {
    throw new Error('Username, name, password and role are required');
  }

  const accounts = await ensureManagedAccountsBootstrapped();
  if (accounts.some((account) => account.username === input.username)) {
    throw new Error('Username already exists');
  }

  const created = await createStoredAccount({
    username: input.username,
    password: input.password,
    name: input.name,
    role: input.role,
    customPermissions: input.customPermissions || [],
  });

  const nextAccounts = [...accounts, created];
  ensureOneSuperAdmin(nextAccounts);
  await saveManagedAccounts(nextAccounts);

  return {
    id: created.id,
    username: created.username,
    name: created.name,
    role: created.role,
    customPermissions: created.customPermissions,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

export async function updateManagedAccount(accountId: string, body: unknown): Promise<AccountInfo> {
  if (!isManagedAuthEnabled()) {
    throw new Error('Managed accounts unavailable');
  }

  const input = sanitizeAccountInput(body);
  const accounts = await ensureManagedAccountsBootstrapped();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);
  if (accountIndex === -1) {
    throw new Error('Account not found');
  }

  const current = accounts[accountIndex];
  const updated: StoredAccountRecord = {
    ...current,
    name: input.name || current.name,
    role: input.role || current.role,
    customPermissions: input.customPermissions ?? current.customPermissions,
    updatedAt: Date.now(),
  };

  if (input.password) {
    const password = await hashPassword(input.password);
    updated.passwordHash = password.hash;
    updated.passwordSalt = password.salt;
  }

  const nextAccounts = accounts.map((account) => account.id === accountId ? updated : account);
  ensureOneSuperAdmin(nextAccounts);
  await saveManagedAccounts(nextAccounts);

  return {
    id: updated.id,
    username: updated.username,
    name: updated.name,
    role: updated.role,
    customPermissions: updated.customPermissions,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function deleteManagedAccount(accountId: string): Promise<void> {
  if (!isManagedAuthEnabled()) {
    throw new Error('Managed accounts unavailable');
  }

  const accounts = await ensureManagedAccountsBootstrapped();
  const nextAccounts = accounts.filter((account) => account.id !== accountId);
  if (nextAccounts.length === accounts.length) {
    throw new Error('Account not found');
  }

  ensureOneSuperAdmin(nextAccounts);
  await saveManagedAccounts(nextAccounts);
}
