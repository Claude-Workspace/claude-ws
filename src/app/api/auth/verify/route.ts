import { NextRequest, NextResponse } from 'next/server';
import { isApiAuthEnabled, verifyApiKey } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { userApiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Verify API key endpoint (supports both global and user-specific)
 * POST /api/auth/verify
 * Body: { apiKey: string, userId?: string }
 * Returns: { valid: boolean, authRequired: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, userId } = body;

    const authRequired = isApiAuthEnabled();

    // If auth is not required, always return valid
    if (!authRequired) {
      return NextResponse.json({ valid: true, authRequired: false });
    }

    // Option 1: Check against global API_ACCESS_KEY (legacy support)
    if (apiKey === process.env.API_ACCESS_KEY) {
      return NextResponse.json({ valid: true, authRequired: true });
    }

    // Option 2: Check against user's API key in database
    if (userId) {
      const keyRecord = db
        .select()
        .from(userApiKeys)
        .where(eq(userApiKeys.userId, userId))
        .get();

      if (keyRecord && keyRecord.apiKey === apiKey) {
        return NextResponse.json({ valid: true, authRequired: true });
      }
    }

    // Invalid key
    return NextResponse.json({ valid: false, authRequired: true });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

/**
 * Check if auth is required
 * GET /api/auth/verify
 * Returns: { authRequired: boolean }
 */
export async function GET() {
  return NextResponse.json({ authRequired: isApiAuthEnabled() });
}
