import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_ACCESS_KEY = process.env.API_ACCESS_KEY;

/**
 * Next.js proxy to protect API routes with API key authentication
 * Runs on the server before the request reaches the route handler
 */
export function proxy(request: NextRequest) {
  // Only check API routes (exclude the verify endpoint itself)
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  const isVerifyEndpoint = request.nextUrl.pathname === '/api/auth/verify';

  // Skip middleware for non-API routes and the verify endpoint
  if (!isApiRoute || isVerifyEndpoint) {
    return NextResponse.next();
  }

  // If no API key is configured, allow all requests
  if (!API_ACCESS_KEY || API_ACCESS_KEY.length === 0) {
    return NextResponse.next();
  }

  // Check for x-api-key header
  const providedKey = request.headers.get('x-api-key');

  if (!providedKey || providedKey !== API_ACCESS_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid API key required' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: '/api/:path*',
};
