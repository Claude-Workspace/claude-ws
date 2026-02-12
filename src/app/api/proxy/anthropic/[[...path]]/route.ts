/**
 * Anthropic API Proxy - Catch-all route with count_tokens caching
 *
 * Handles all paths under /api/proxy/anthropic/* (e.g., /v1/messages)
 * Forwards requests to ANTHROPIC_PROXIED_BASE_URL or default Anthropic API.
 * Caches count_tokens responses to reduce API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  generateCacheKey,
  getCached,
  setCached,
  isExpired,
  evictIfNeeded,
  recordHit,
  recordMiss,
  recordBypassed,
  type CachedResponse,
} from '@/lib/proxy-token-cache';

const log = createLogger('AnthropicProxy');
const DEFAULT_ANTHROPIC_URL = 'https://api.anthropic.com';

// Retry configuration from environment
const RETRY_TIMES = parseInt(process.env.ANTHROPIC_API_RETRY_TIMES || '3', 10);
const RETRY_DELAY_MS = parseInt(process.env.ANTHROPIC_API_RETRY_DELAY_MS || '10000', 10);

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt = 1
): Promise<Response> {
  log.info({ attempt, retryTimes: RETRY_TIMES, url }, `fetchWithRetry attempt ${attempt}/${RETRY_TIMES} to ${url}`);
  try {
    const response = await fetch(url, options);

    // Retry on network errors or 5xx server errors
    if (!response.ok && response.status >= 500 && attempt < RETRY_TIMES) {
      log.warn(
        { attempt, retryTimes: RETRY_TIMES, status: response.status, url },
        `Anthropic API request failed (attempt ${attempt}/${RETRY_TIMES}), retrying in ${RETRY_DELAY_MS}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, attempt + 1);
    }

    // Log error when all retries exhausted for 5xx errors
    if (!response.ok && response.status >= 500) {
      log.error(
        { attempt, retryTimes: RETRY_TIMES, status: response.status, statusText: response.statusText, url },
        `Anthropic API request failed after ${RETRY_TIMES} attempts`
      );
    }

    // 4xx errors should not be retried
    if (!response.ok && response.status >= 400 && response.status < 500) {
      return response;
    }

    return response;
  } catch (error) {
    // Network errors - retry if attempts remaining
    if (attempt < RETRY_TIMES) {
      log.warn(
        { attempt, retryTimes: RETRY_TIMES, error, url },
        `Anthropic API network error (attempt ${attempt}/${RETRY_TIMES}), retrying in ${RETRY_DELAY_MS}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, attempt + 1);
    }

    // Log error when all retries exhausted for network errors
    log.error(
      { attempt, retryTimes: RETRY_TIMES, error, url },
      `Anthropic API network error after ${RETRY_TIMES} attempts`
    );
    throw error;
  }
}

/**
 * Get the target URL for proxying requests
 */
function getTargetBaseUrl(): string {
  return process.env.ANTHROPIC_PROXIED_BASE_URL || DEFAULT_ANTHROPIC_URL;
}

/**
 * Forward request to target Anthropic API
 */
async function proxyRequest(
  request: NextRequest,
  method: string
): Promise<Response> {
  log.info('[AnthropicProxy] ===== proxyRequest called =====');
  const targetBase = getTargetBaseUrl();

  // Get the path after /api/proxy/anthropic
  const url = new URL(request.url);
  const pathAfterProxy = url.pathname.replace('/api/proxy/anthropic', '');
  const targetUrl = `${targetBase}${pathAfterProxy}${url.search}`;

  // Check if this is a count_tokens request (cacheable)
  const isCountTokens = pathAfterProxy.includes('/v1/messages/count_tokens');

  // Clone headers, removing host-specific ones
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey !== 'host' &&
      lowerKey !== 'connection' &&
      lowerKey !== 'content-length' &&
      !lowerKey.startsWith('x-forwarded') &&
      !lowerKey.startsWith('x-real')
    ) {
      headers.set(key, value);
    }
  });

  // Ensure API key is set
  if (!headers.has('x-api-key') && !headers.has('authorization')) {
    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      headers.set('x-api-key', apiKey);
    }
  }

  // Get request body for POST requests
  let body = '';
  if (method !== 'GET' && method !== 'HEAD') {
    body = await request.text();
  }

  // Check cache for count_tokens requests
  if (isCountTokens && method === 'POST' && body) {
    const cacheKey = generateCacheKey(body);
    const cached = getCached(cacheKey);

    if (cached && !isExpired(cached)) {
      recordHit();
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: new Headers(cached.headers),
      });
    }
    recordMiss();
  } else {
    recordBypassed();
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body) {
    fetchOptions.body = body;
  }

  try {
    log.info({ targetUrl, hasBody: !!body }, 'Start proxying request');
    const response = await fetchWithRetry(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    log.info({ targetUrl, status: response.status }, 'End proxying request');

    if (!response.ok) {
      log.error({ targetUrl, status: response.status, statusText: response.statusText, requestBody: JSON.stringify(body), responseBody: JSON.stringify(await response.text()) }, 'Anthropic API error');
    }
    const isStreaming = contentType.includes('text/event-stream');

    if (isStreaming && response.body) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': contentType,
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        },
      });
    }

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'content-encoding' && lowerKey !== 'transfer-encoding') {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = await response.text();

    // Cache successful count_tokens responses
    if (isCountTokens && method === 'POST' && response.ok && body) {
      const cacheKey = generateCacheKey(body);
      evictIfNeeded();

      const headersObj: Record<string, string> = {};
      responseHeaders.forEach((value, key) => {
        headersObj[key] = value;
      });

      const entry: CachedResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: headersObj,
        body: responseBody,
        cachedAt: Date.now(),
      };
      setCached(cacheKey, entry);
    }

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    log.error({ error, requestBody: JSON.stringify(body), targetUrl }, 'Error forwarding request');
    return NextResponse.json(
      { error: 'Proxy error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT');
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, 'PATCH');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}

export async function OPTIONS(request: NextRequest) {
  return proxyRequest(request, 'OPTIONS');
}
