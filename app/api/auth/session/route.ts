import { NextRequest } from 'next/server';
import { createSessionStatusResponse, logoutResponse } from '@/lib/server/auth';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  return createSessionStatusResponse(request);
}

export async function DELETE() {
  return logoutResponse();
}
