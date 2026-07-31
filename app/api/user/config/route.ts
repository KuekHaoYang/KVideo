/**
 * User Config Sync API Route (Edge Runtime)
 * Upstash Redis-backed settings persistence for cross-device and PWA support.
 * Stores user settings (sources, display preferences) server-side
 * so they persist across browsers, devices, and PWA installs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { getRedisClient } from '@/lib/server/redis';

export const runtime = 'edge';

function redisKey(profileId: string): string {
  const safe = profileId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `user:config:${safe}`;
}

function syncUnavailableResponse() {
  return NextResponse.json(
    { error: 'Server-side sync is not configured on this deployment' },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return authenticationRequiredResponse();
  }

  const redis = getRedisClient();
  if (!redis) {
    return syncUnavailableResponse();
  }

  try {
    const data = await redis.get(redisKey(profileId));
    return NextResponse.json({ success: true, data: data || null });
  } catch (error) {
    console.error('Config read error:', error);
    return NextResponse.json(
      { error: 'Failed to read config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return authenticationRequiredResponse();
  }

  const redis = getRedisClient();
  if (!redis) {
    return syncUnavailableResponse();
  }

  try {
    const body = await request.json();
    const key = redisKey(profileId);

    // Merge with existing data if present
    const existing = (await redis.get(key)) as Record<string, unknown> | null;
    const merged = { ...(existing || {}), ...body, updatedAt: Date.now() };

    await redis.set(key, merged);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Config write error:', error);
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}
