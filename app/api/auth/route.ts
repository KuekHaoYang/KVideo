/**
 * Auth API Route
 * Handles authentication with role-based accounts
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';
const ACCOUNTS = process.env.ACCOUNTS || '';
const PREMIUM_PASSWORD = process.env.PREMIUM_PASSWORD || '';
const PERSIST_SESSION = process.env.PERSIST_SESSION !== 'false'; // default true
const SUBSCRIPTION_SOURCES = process.env.SUBSCRIPTION_SOURCES || process.env.NEXT_PUBLIC_SUBSCRIPTION_SOURCES || '';
const IPTV_SOURCES = process.env.IPTV_SOURCES || process.env.NEXT_PUBLIC_IPTV_SOURCES || '';
const MERGE_SOURCES = process.env.MERGE_SOURCES || process.env.NEXT_PUBLIC_MERGE_SOURCES || '';

// Backward compat: ACCESS_PASSWORD acts as ADMIN_PASSWORD if ADMIN_PASSWORD is not set
const effectiveAdminPassword = ADMIN_PASSWORD || ACCESS_PASSWORD;

interface AccountEntry {
  password: string;
  name: string;
  role: 'super_admin' | 'admin' | 'viewer';
  customPermissions: string[];
}

function parseAccounts(): AccountEntry[] {
  if (!ACCOUNTS) return [];

  return ACCOUNTS.split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
    .map(entry => {
      const parts = entry.split(':');
      if (parts.length < 2) return null;
      const [password, name, role, perms] = parts;
      const parsedRole = role?.trim();
      const customPermissions = perms
        ? perms.split('|').map(p => p.trim()).filter(p => p.length > 0)
        : [];
      return {
        password: password.trim(),
        name: name.trim(),
        role: (parsedRole === 'super_admin' ? 'super_admin' : parsedRole === 'admin' ? 'admin' : 'viewer') as 'super_admin' | 'admin' | 'viewer',
        customPermissions,
      };
    })
    .filter((a): a is AccountEntry => a !== null && a.password.length > 0 && a.name.length > 0);
}

/**
 * Generate a deterministic profileId from password using SHA-256.
 * Uses a salt to avoid rainbow table attacks.
 */
async function generateProfileId(password: string): Promise<string> {
  const salt = 'kvideo-profile-salt-v1';
  const data = new TextEncoder().encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  // Use first 8 bytes (16 hex chars) for a compact but unique ID
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function GET() {
  const hasAuth = !!(effectiveAdminPassword || ACCOUNTS);

  return NextResponse.json({
    hasAuth,
    hasPremiumAuth: !!PREMIUM_PASSWORD,
    persistSession: PERSIST_SESSION,
    subscriptionSources: SUBSCRIPTION_SOURCES,
    iptvSources: IPTV_SOURCES,
    mergeSources: MERGE_SOURCES,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { password, type } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ valid: false, message: 'Password required' }, { status: 400 });
    }

    // Premium password check (separate from main auth)
    if (type === 'premium') {
      if (!PREMIUM_PASSWORD) {
        // No premium password configured = open access
        return NextResponse.json({ valid: true });
      }
      if (password === PREMIUM_PASSWORD) {
        return NextResponse.json({ valid: true });
      }
      // Also allow admin password to unlock premium
      if (effectiveAdminPassword && password === effectiveAdminPassword) {
        return NextResponse.json({ valid: true });
      }
      // Check ACCOUNTS super_admin/admin
      const accounts = parseAccounts();
      for (const account of accounts) {
        if (password === account.password && (account.role === 'super_admin' || account.role === 'admin')) {
          return NextResponse.json({ valid: true });
        }
      }
      return NextResponse.json({ valid: false });
    }

    // 1. Check admin password
    if (effectiveAdminPassword && password === effectiveAdminPassword) {
      const profileId = await generateProfileId(password);
      return NextResponse.json({
        valid: true,
        name: '管理员',
        role: 'super_admin',
        profileId,
        persistSession: PERSIST_SESSION,
      });
    }

    // 2. Check ACCOUNTS entries
    const accounts = parseAccounts();
    for (const account of accounts) {
      if (password === account.password) {
        const profileId = await generateProfileId(password);
        return NextResponse.json({
          valid: true,
          name: account.name,
          role: account.role,
          profileId,
          persistSession: PERSIST_SESSION,
          customPermissions: account.customPermissions.length > 0 ? account.customPermissions : undefined,
        });
      }
    }

    // 3. No match
    return NextResponse.json({ valid: false });
  } catch {
    return NextResponse.json({ valid: false, message: 'Invalid request' }, { status: 400 });
  }
}
