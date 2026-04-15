import {
  normalizePermissions,
  normalizeRole,
  type Permission,
  type Role,
} from '@/lib/auth/permissions';

export interface SeedAccountInput {
  username: string;
  password: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
}

export interface StoredAccountRecord {
  id: string;
  username: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
  passwordHash: string;
  passwordSalt: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionPayload {
  accountId: string;
  profileId: string;
  username?: string;
  name: string;
  role: Role;
  customPermissions?: Permission[];
  mode: 'managed' | 'legacy';
  iat: number;
}

const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_KEY_BYTES = 32;
const SESSION_TOKEN_VERSION = 'v1';

function bytesToBinary(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return binary;
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return binaryToBytes(atob(`${normalized}${padding}`));
}

function encodeText(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importPbkdf2Key(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', toArrayBuffer(encodeText(password)), 'PBKDF2', false, ['deriveBits']);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(encodeText(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export function createRandomToken(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const effectiveSalt = salt || createRandomToken();
  const key = await importPbkdf2Key(password);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: toArrayBuffer(encodeText(effectiveSalt)),
    },
    key,
    PBKDF2_KEY_BYTES * 8
  );

  return {
    hash: encodeBase64Url(new Uint8Array(bits)),
    salt: effectiveSalt,
  };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const actual = await hashPassword(password, salt);
  return actual.hash === expectedHash;
}

export async function signSessionPayload(payload: SessionPayload, secret: string): Promise<string> {
  const payloadBytes = encodeText(JSON.stringify(payload));
  const encodedPayload = encodeBase64Url(payloadBytes);
  const message = `${SESSION_TOKEN_VERSION}.${encodedPayload}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(encodeText(message)));

  return `${message}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [version, encodedPayload, encodedSignature] = parts;
  if (version !== SESSION_TOKEN_VERSION) return null;

  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    toArrayBuffer(decodeBase64Url(encodedSignature)),
    toArrayBuffer(encodeText(`${version}.${encodedPayload}`))
  );

  if (!valid) return null;

  try {
    const payload = JSON.parse(decodeText(decodeBase64Url(encodedPayload)));
    if (!payload || typeof payload !== 'object') return null;
    if (!payload.accountId || !payload.profileId || !payload.name || !payload.role || !payload.mode || !payload.iat) {
      return null;
    }

    return {
      accountId: String(payload.accountId),
      profileId: String(payload.profileId),
      username: payload.username ? String(payload.username) : undefined,
      name: String(payload.name),
      role: normalizeRole(payload.role),
      customPermissions: normalizePermissions(payload.customPermissions),
      mode: payload.mode === 'managed' ? 'managed' : 'legacy',
      iat: Number(payload.iat),
    };
  } catch {
    return null;
  }
}

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ensureUniqueUsername(
  preferredValue: string,
  existingUsernames: ReadonlySet<string>,
  fallbackValue: string
): string {
  const fallbackBase = normalizeUsername(fallbackValue) || 'user';
  const preferredBase = normalizeUsername(preferredValue) || fallbackBase;

  if (!existingUsernames.has(preferredBase)) {
    return preferredBase;
  }

  let suffix = 2;
  while (existingUsernames.has(`${preferredBase}-${suffix}`)) {
    suffix += 1;
  }

  return `${preferredBase}-${suffix}`;
}

export function parseBootstrapAccounts(rawAccounts: string): SeedAccountInput[] {
  if (!rawAccounts.trim()) return [];

  const usernames = new Set<string>();
  const seeds: SeedAccountInput[] = [];

  rawAccounts
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry, index) => {
      const parts = entry.split(':').map((part) => part.trim());
      if (parts.length < 2) return;

      let username = '';
      let password = '';
      let name = '';
      let rolePart = '';
      let permissionsPart = '';

      if (parts.length === 2) {
        [password, name] = parts;
      } else if (parts.length === 3) {
        if (parts[2] === 'viewer' || parts[2] === 'admin' || parts[2] === 'super_admin') {
          [password, name, rolePart] = parts;
        } else {
          [username, password, name] = parts;
        }
      } else if (parts.length === 4 && (parts[2] === 'viewer' || parts[2] === 'admin' || parts[2] === 'super_admin')) {
        [password, name, rolePart, permissionsPart] = parts;
      } else {
        [username, password, name, rolePart, permissionsPart] = parts;
      }

      if (!password || !name) return;

      const normalizedUsername = ensureUniqueUsername(
        username || name,
        usernames,
        `user-${index + 1}`
      );

      usernames.add(normalizedUsername);
      seeds.push({
        username: normalizedUsername,
        password,
        name,
        role: normalizeRole(rolePart),
        customPermissions: normalizePermissions(permissionsPart ? permissionsPart.split('|') : []),
      });
    });

  return seeds;
}

export async function createStoredAccount(
  input: SeedAccountInput,
  now = Date.now()
): Promise<StoredAccountRecord> {
  const password = await hashPassword(input.password);

  return {
    id: crypto.randomUUID(),
    username: input.username,
    name: input.name,
    role: input.role,
    customPermissions: input.customPermissions,
    passwordHash: password.hash,
    passwordSalt: password.salt,
    createdAt: now,
    updatedAt: now,
  };
}
