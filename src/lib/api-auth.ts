import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

const API_ACCESS_KEY = process.env.API_ACCESS_KEY;

/**
 * Timing-safe string comparison to prevent timing attacks on API key validation.
 * Exported for use in server.ts and other non-Next.js contexts.
 */
export function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Compare with self to maintain constant time regardless of length mismatch
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Check if API authentication is enabled
 */
export function isApiAuthEnabled(): boolean {
  return Boolean(API_ACCESS_KEY && API_ACCESS_KEY.length > 0);
}

/**
 * Verify API key from request headers
 * Returns true if auth is disabled or key matches
 */
export function verifyApiKey(request: NextRequest): boolean {
  // If no API key is configured, allow all requests
  if (!isApiAuthEnabled()) {
    return true;
  }

  const providedKey = request.headers.get('x-api-key');
  if (!providedKey || !API_ACCESS_KEY) return false;
  return safeCompare(providedKey, API_ACCESS_KEY);
}

/**
 * Middleware response for unauthorized requests
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized', message: 'Valid API key required' },
    { status: 401 }
  );
}

/**
 * Wrap a handler with API key authentication
 * Use this in route handlers to protect endpoints
 */
export function withApiAuth(
  handler: (request: NextRequest) => Promise<Response> | Response
) {
  return async (request: NextRequest) => {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }
    return handler(request);
  };
}
