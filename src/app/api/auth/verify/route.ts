import { NextRequest, NextResponse } from 'next/server';
import { createAuthVerificationService } from '@agentic-sdk/services/auth-verification-service';

const authService = createAuthVerificationService(process.env.API_ACCESS_KEY);

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
    const authRequired = authService.isAuthEnabled();
    if (!authRequired) {
      return NextResponse.json({ valid: true, authRequired: false });
    }
    const valid = typeof apiKey === 'string' && authService.verifyKeyValue(apiKey);
    return NextResponse.json({ valid, authRequired: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

/**
 * Check if auth is required
 * GET /api/auth/verify
 * Returns: { authRequired: boolean }
 */
export async function GET() {
  return NextResponse.json({ authRequired: authService.isAuthEnabled() });
}
