import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const API_ACCESS_KEY = process.env.API_ACCESS_KEY;

// Create i18n middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  localeDetection: true,
});

/**
 * Next.js proxy for API authentication and i18n routing
 * Runs on the server before the request reaches the route handler
 */
export function proxy(request: NextRequest) {
  // Handle API routes with authentication
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  const isVerifyEndpoint = request.nextUrl.pathname === '/api/auth/verify';

  if (isApiRoute && !isVerifyEndpoint) {
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

// Configure which routes the proxy should run on
export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
