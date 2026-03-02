import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// 确保这行代码在整个文件中只出现一次
export const runtime = 'edge';

const redis = Redis.fromEnv();

export async function GET(request: NextRequest) {
  const profileId = request.headers.get('x-profile-id');
  
  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
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
  const profileId = request.headers.get('x-profile-id');
  
  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { history, favorites } = body;

    await redis.set(`user:sync:${profileId}`, { history, favorites });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Redis Set Error:', error);
    return NextResponse.json({ error: 'Failed to save sync data' }, { status: 500 });
  }
}
