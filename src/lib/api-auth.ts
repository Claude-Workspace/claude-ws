import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_ACCESS_KEY = process.env.API_ACCESS_KEY;

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
  return providedKey === API_ACCESS_KEY;
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
