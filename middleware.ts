import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from './src/i18n/config';

const API_ACCESS_KEY = process.env.API_ACCESS_KEY;

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

  if (isApiRoute && !isVerifyEndpoint && !isTunnelStatusEndpoint) {
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

  // Handle i18n for non-API routes
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames including API routes
  // Skip static files and Next.js internals
  matcher: ['/((?!_next|_vercel|.*\\..*).*)', '/api/:path*']
};
