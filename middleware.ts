import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from './src/i18n/config';

// Create i18n middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  localeDetection: true,
});

// Helper to add no-cache headers in development
function addNoCacheHeaders(response: NextResponse): NextResponse {
  if (process.env.NODE_ENV === 'production') {
    return response;
  }
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

/**
 * Next.js middleware for API authentication and i18n routing
 * API auth is also handled in server.ts for custom server deployments
 * This provides a fallback for standard Next.js deployments
 */
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // API routes must bypass i18n middleware to avoid locale prefix rewriting (e.g. /en/api/...)
  if (pathname.startsWith('/api/')) {
    const isVerifyEndpoint = pathname === '/api/auth/verify';
    const isTunnelStatusEndpoint = pathname === '/api/tunnel/status';
    const isApiAccessKeyEndpoint = pathname === '/api/settings/api-access-key';

    // Skip auth for whitelisted endpoints
    if (isVerifyEndpoint || isTunnelStatusEndpoint || isApiAccessKeyEndpoint) {
      return addNoCacheHeaders(NextResponse.next());
    }

    // Read from process.env directly for immediate effect when key is updated
    const apiAccessKey = process.env.API_ACCESS_KEY;

    // If no API key is configured, allow all requests
    if (!apiAccessKey || apiAccessKey.length === 0) {
      return addNoCacheHeaders(NextResponse.next());
    }

    // Check for x-api-key header
    const providedKey = request.headers.get('x-api-key');

    if (!providedKey || providedKey !== apiAccessKey) {
      return addNoCacheHeaders(NextResponse.json(
        { error: 'Unauthorized', message: 'Valid API key required' },
        { status: 401 }
      ));
    }

    return addNoCacheHeaders(NextResponse.next());
  }

  // Handle i18n for non-API routes only
  return addNoCacheHeaders(intlMiddleware(request));
}

export const config = {
  // Match all pathnames including API routes
  // Skip static files and Next.js internals
  matcher: ['/((?!_next|_vercel|.*\\..*).*)', '/api/:path*']
};
