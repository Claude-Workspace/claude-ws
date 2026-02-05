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

/**
 * Next.js middleware for API authentication and i18n routing
 * API auth is also handled in server.ts for custom server deployments
 * This provides a fallback for standard Next.js deployments
 */
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle API routes with authentication
  const isApiRoute = pathname.startsWith('/api/');
  const isVerifyEndpoint = pathname === '/api/auth/verify';
  const isTunnelStatusEndpoint = pathname === '/api/tunnel/status';
  const isApiAccessKeyEndpoint = pathname === '/api/settings/api-access-key';

  // Skip auth for verify, tunnel status, and api-access-key endpoints
  if (isApiRoute && !isVerifyEndpoint && !isTunnelStatusEndpoint && !isApiAccessKeyEndpoint) {
    // Read from process.env directly for immediate effect when key is updated
    const apiAccessKey = process.env.API_ACCESS_KEY;

    // If no API key is configured, allow all requests
    if (!apiAccessKey || apiAccessKey.length === 0) {
      return NextResponse.next();
    }

    // Check for x-api-key header
    const providedKey = request.headers.get('x-api-key');

    if (!providedKey || providedKey !== apiAccessKey) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid API key required' },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // Handle i18n for non-API routes
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames including API routes
  // Skip static files and Next.js internals
  matcher: ['/((?!_next|_vercel|.*\\..*).*)', '/api/:path*']
};
