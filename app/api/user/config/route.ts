/**
 * User Config Sync API Route (Edge Runtime)
 * Upstash Redis-backed settings persistence for cross-device and PWA support.
 * Stores user settings (sources, display preferences) server-side
 * so they persist across browsers, devices, and PWA installs.
 */

import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const redis = Redis.fromEnv();

function redisKey(profileId: string): string {
  const safe = profileId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `user:config:${safe}`;
}

export async function GET(request: NextRequest) {
  const profileId = request.headers.get('x-profile-id');

  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
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
  const profileId = request.headers.get('x-profile-id');

  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const key = redisKey(profileId);

    // Merge with existing data if present
    const existing = (await redis.get(key)) as Record<string, any> | null;
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
