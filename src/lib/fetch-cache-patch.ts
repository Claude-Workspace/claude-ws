/**
 * Fetch Cache Patch - Caches count_tokens API responses
 *
 * MUST be imported before @anthropic-ai/claude-agent-sdk to intercept all fetch calls.
 * Reduces ~49 count_tokens requests per message to cache hits after first request.
 *
 * Works with any auth method (CLI auth, API key, OAuth) since it only caches
 * responses, not credentials.
 *
 * Persistence: Each cached entry is saved as a separate JSON file in DATA_DIR/token-cache/
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';

interface CachedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  cachedAt: number;
}

// Cache configuration
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cache directory (uses DATA_DIR env or falls back to ./data)
const DATA_DIR = process.env.DATA_DIR || './data';
const CACHE_DIR = join(DATA_DIR, 'token-cache');

// Ensure cache directory exists
try {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[FetchCachePatch] Failed to create cache directory:', err);
}

// In-memory cache (loaded from files on startup)
const cache = new Map<string, CachedResponse>();

// Stats for monitoring
const stats = {
  hits: 0,
  misses: 0,
  bypassed: 0, // Requests that don't match count_tokens
};

/**
 * Get file path for a cache key
 */
function getCacheFilePath(key: string): string {
  return join(CACHE_DIR, `${key}.json`);
}

/**
 * Load cache entry from file
 */
function loadFromFile(key: string): CachedResponse | null {
  try {
    const filePath = getCacheFilePath(key);
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as CachedResponse;
  } catch {
    return null;
  }
}

/**
 * Save cache entry to file
 */
function saveToFile(key: string, entry: CachedResponse): void {
  try {
    const filePath = getCacheFilePath(key);
    writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
  } catch (err) {
    console.warn('[FetchCachePatch] Failed to save cache file:', err);
  }
}

/**
 * Delete cache file
 */
function deleteFile(key: string): void {
  try {
    const filePath = getCacheFilePath(key);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Ignore deletion errors
  }
}

/**
 * Load all cached entries from disk on startup
 */
function loadCacheFromDisk(): void {
  try {
    if (!existsSync(CACHE_DIR)) return;
    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    let loaded = 0;
    let expired = 0;

    for (const file of files) {
      const key = file.replace('.json', '');
      const entry = loadFromFile(key);
      if (entry) {
        if (isExpired(entry)) {
          deleteFile(key);
          expired++;
        } else {
          cache.set(key, entry);
          loaded++;
        }
      }
    }

    if (loaded > 0 || expired > 0) {
      console.log(`[FetchCachePatch] Loaded ${loaded} cached entries, cleaned ${expired} expired`);
    }
  } catch (err) {
    console.warn('[FetchCachePatch] Failed to load cache from disk:', err);
  }
}

// Load cache from disk on startup
loadCacheFromDisk();

/**
 * Generate cache key from request body
 * Only hashes stable fields: model + tools schema
 */
function generateCacheKey(body: string): string {
  try {
    const parsed = JSON.parse(body);
    // Only hash model + tools (these are stable across requests)
    const hashInput = JSON.stringify({
      model: parsed.model,
      tools: parsed.tools,
    });
    return createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
  } catch {
    // Fallback to hashing entire body
    return createHash('sha256').update(body).digest('hex').slice(0, 16);
  }
}

/**
 * Check if cached entry has expired
 */
function isExpired(entry: CachedResponse): boolean {
  return Date.now() - entry.cachedAt > CACHE_TTL_MS;
}

/**
 * Evict oldest entry if cache is full
 */
function evictIfNeeded(): void {
  if (cache.size >= CACHE_MAX_SIZE) {
    // Map maintains insertion order, so first key is oldest
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
      deleteFile(oldestKey);
    }
  }
}

/**
 * Clean up expired entries periodically (both memory and disk)
 */
function cleanupExpired(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  // Clean memory cache
  cache.forEach((entry, key) => {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => {
    cache.delete(key);
    deleteFile(key);
  });

  // Also clean orphan files on disk
  try {
    if (!existsSync(CACHE_DIR)) return;
    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const key = file.replace('.json', '');
      if (!cache.has(key)) {
        const entry = loadFromFile(key);
        if (!entry || isExpired(entry)) {
          deleteFile(key);
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

// Run cleanup every 5 minutes
const cleanupInterval = setInterval(cleanupExpired, 5 * 60 * 1000);
cleanupInterval.unref(); // Don't prevent process exit

// Store original fetch before patching
const originalFetch = globalThis.fetch;

/**
 * Patched fetch function that caches count_tokens responses
 */
async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Get URL string
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  // Only intercept POST requests to count_tokens endpoint
  const isCountTokens = url.includes('/v1/messages/count_tokens');
  const isPost = !init?.method || init.method.toUpperCase() === 'POST';

  if (isCountTokens && isPost && init?.body) {
    // Extract body as string
    let bodyStr: string;
    if (typeof init.body === 'string') {
      bodyStr = init.body;
    } else if (init.body instanceof Buffer) {
      bodyStr = init.body.toString('utf-8');
    } else if (init.body instanceof ArrayBuffer) {
      bodyStr = Buffer.from(init.body).toString('utf-8');
    } else if (init.body instanceof Uint8Array) {
      bodyStr = Buffer.from(init.body).toString('utf-8');
    } else {
      // For streams or other types, can't cache - pass through
      stats.bypassed++;
      return originalFetch(input, init);
    }

    const cacheKey = generateCacheKey(bodyStr);
    const cached = cache.get(cacheKey);

    // Return cached response if valid
    if (cached && !isExpired(cached)) {
      stats.hits++;
      // Reconstruct Response object from cached data
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: new Headers(cached.headers),
      });
    }

    stats.misses++;

    // Forward to original fetch
    const response = await originalFetch(input, init);

    // Only cache successful responses
    if (response.ok) {
      try {
        // Clone response to read body without consuming original
        const clonedResponse = response.clone();
        const body = await clonedResponse.text();

        // Extract headers
        const headers: Record<string, string> = {};
        clonedResponse.headers.forEach((value, key) => {
          headers[key] = value;
        });

        // Evict old entries if needed
        evictIfNeeded();

        // Store in cache and persist to file
        const entry: CachedResponse = {
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
          cachedAt: Date.now(),
        };
        cache.set(cacheKey, entry);
        saveToFile(cacheKey, entry);
      } catch (error) {
        // Caching failed, but original response is still valid
        console.warn('[FetchCachePatch] Failed to cache response:', error);
      }
    }

    return response;
  }

  // Pass through all non-count_tokens requests
  stats.bypassed++;
  return originalFetch(input, init);
}

// Apply the patch
globalThis.fetch = patchedFetch as typeof fetch;

console.log('[FetchCachePatch] Global fetch patched for count_tokens caching');

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  return {
    hits: stats.hits,
    misses: stats.misses,
    bypassed: stats.bypassed,
    size: cache.size,
    hitRate: stats.hits + stats.misses > 0
      ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1) + '%'
      : '0%',
  };
}

/**
 * Clear all cached entries and reset stats
 */
export function clearCache() {
  cache.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.bypassed = 0;
  console.log('[FetchCachePatch] Cache cleared');
}

/**
 * Log cache stats (for debugging)
 */
export function logCacheStats() {
  const s = getCacheStats();
  console.log(`[FetchCachePatch] Stats: ${s.hits} hits, ${s.misses} misses, ${s.size} cached, ${s.hitRate} hit rate`);
}
