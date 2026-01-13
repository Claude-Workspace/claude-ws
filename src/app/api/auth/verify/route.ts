import { NextRequest, NextResponse } from 'next/server';
import { isApiAuthEnabled, verifyApiKey } from '@/lib/api-auth';

/**
 * Verify API key endpoint
 * POST /api/auth/verify
 * Body: { apiKey: string }
 * Returns: { valid: boolean, authRequired: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    const authRequired = isApiAuthEnabled();

    // If auth is not required, always return valid
    if (!authRequired) {
      return NextResponse.json({ valid: true, authRequired: false });
    }

    // Check if provided key matches
    const valid = apiKey === process.env.API_ACCESS_KEY;

    return NextResponse.json({ valid, authRequired: true });
  } catch {
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
