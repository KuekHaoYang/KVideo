import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getPublicAuthConfig, getServerSession, type ServerAuthSession } from '@/lib/server/auth';

function relayDisabledResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function isPublicRelayEnabled(): boolean {
  return process.env.KVIDEO_PUBLIC_RELAY_ENABLED === 'true';
}

interface AccessResult {
  config: Awaited<ReturnType<typeof getPublicAuthConfig>>;
  session: ServerAuthSession | null;
  error?: NextResponse;
}

export async function requireAuthenticatedRequestIfConfigured(request: NextRequest): Promise<AccessResult> {
  const config = await getPublicAuthConfig();

  if (config.authError) {
    return {
      config,
      session: null,
      error: relayDisabledResponse(config.authError, 503),
    };
  }

  if (!config.hasAuth) {
    return { config, session: null };
  }

  const session = await getServerSession(request);
  if (!session) {
    return {
      config,
      session: null,
      error: relayDisabledResponse('Authentication required', 401),
    };
  }

  return { config, session };
}

export async function requireRelayAccess(request: NextRequest): Promise<AccessResult> {
  const access = await requireAuthenticatedRequestIfConfigured(request);
  if (access.error) {
    return access;
  }

  if (!access.config.hasAuth && !isPublicRelayEnabled()) {
    return {
      ...access,
      error: relayDisabledResponse(
        'Public relay routes are disabled unless KVIDEO_PUBLIC_RELAY_ENABLED=true',
        403,
      ),
    };
  }

  return access;
}

export function buildSameOriginOptionsResponse(request: NextRequest, methods: string): NextResponse {
  const origin = request.headers.get('origin');
  const allowOrigin = origin === request.nextUrl.origin ? origin : request.nextUrl.origin;

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    },
  });
}
