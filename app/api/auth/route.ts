import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateLogin,
  createLoginResponse,
  getPublicAuthConfig,
  validatePremiumAccess,
} from '@/lib/server/auth';
import {
  clearAuthFailures,
  getAuthThrottleStatus,
  recordAuthFailure,
} from '@/lib/server/auth-rate-limit';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(await getPublicAuthConfig());
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
      type?: unknown;
    };
    const username = typeof body.username === 'string' ? body.username : undefined;
    const password = typeof body.password === 'string' ? body.password : undefined;
    const type = body.type === 'premium' ? 'premium' : 'login';
    const throttle = await getAuthThrottleStatus(request, username, type);

    if (throttle.blocked) {
      return NextResponse.json(
        {
          valid: false,
          message: 'Too many failed attempts. Please try again later.',
          retryAfter: throttle.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(throttle.retryAfterSeconds),
          },
        },
      );
    }

    if (type === 'premium') {
      const valid = await validatePremiumAccess(request, { username, password });
      if (valid) {
        await clearAuthFailures(request, username, type);
      } else {
        await recordAuthFailure(request, username, type);
      }
      return NextResponse.json({ valid });
    }

    if (!password) {
      return NextResponse.json({ valid: false, message: 'Password required' }, { status: 400 });
    }

    const session = await authenticateLogin({ username, password });
    if (!session) {
      await recordAuthFailure(request, username, type);
      return NextResponse.json({ valid: false });
    }

    await clearAuthFailures(request, username, type);
    return createLoginResponse(session);
  } catch {
    return NextResponse.json({ valid: false, message: 'Invalid request' }, { status: 400 });
  }
}
