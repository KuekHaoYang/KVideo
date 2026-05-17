import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/server/auth';
import { getRedisClient } from '@/lib/server/redis-client';

// 确保这行代码在整个文件中只出现一次
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;
  
  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  }

  const redis = getRedisClient();
  if (!redis) {
    return NextResponse.json({
      success: true,
      data: { history: [], favorites: [] },
      synced: false,
    });
  }

  try {
    const data = await redis.get(`user:sync:${profileId}`);
    return NextResponse.json({ 
      success: true, 
      data: data || { history: [], favorites: [] } 
    });
  } catch (error) {
    console.error('Redis Get Error:', error);
    return NextResponse.json({ error: 'Failed to fetch sync data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;
  
  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  }

  const redis = getRedisClient();
  if (!redis) {
    return NextResponse.json({ success: true, synced: false });
  }

  try {
    const body = await request.json();
    const { history, favorites } = body;

    await redis.set(`user:sync:${profileId}`, { history, favorites });

    return NextResponse.json({ success: true, synced: true });
  } catch (error) {
    console.error('Redis Set Error:', error);
    return NextResponse.json({ error: 'Failed to save sync data' }, { status: 500 });
  }
}
