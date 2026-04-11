/**
 * Config API Route (Simplified)
 * Only returns non-auth configuration now.
 * Auth has moved to /api/auth.
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

const SUBSCRIPTION_SOURCES = process.env.SUBSCRIPTION_SOURCES || process.env.NEXT_PUBLIC_SUBSCRIPTION_SOURCES || '';

export async function GET() {
    return NextResponse.json({
        subscriptionSources: SUBSCRIPTION_SOURCES,
    });
}
