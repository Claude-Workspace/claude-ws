/**
 * Proxy Token Cache - Shared cache module for count_tokens responses
 *
 * Provides in-memory + disk-backed caching for Anthropic token count responses.
 * Separated from the route handler to allow importing from server.ts without
 * Next.js AsyncLocalStorage issues.
 */

import { createHash } from 'crypto';
import { createLogger } from '@/lib/logger';
import { loadAllFromDisk, saveToFile, deleteFile } from '@/lib/proxy-token-cache-disk-storage';

const log = createLogger('ProxyTokenCache');

// Cache configuration
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface CachedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  cachedAt: number;
}

// In-memory cache
const cache = new Map<string, CachedResponse>();

// Stats for monitoring
const stats = { hits: 0, misses: 0, bypassed: 0 };

/**
 * Check if a cached entry has expired
 */
export function isExpired(entry: CachedResponse): boolean {
  return Date.now() - entry.cachedAt > CACHE_TTL_MS;
}

// Load persisted cache entries from disk on module load
loadAllFromDisk(cache, isExpired);

/**
 * Generate cache key from request body (hashes model + tools)
 */
export function generateCacheKey(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const hashInput = JSON.stringify({ model: parsed.model, tools: parsed.tools });
    return createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
  } catch {
    return createHash('sha256').update(body).digest('hex').slice(0, 16);
  }
}

/**
 * Evict the oldest entry if the cache is at capacity
 */
export function evictIfNeeded(): void {
  if (cache.size >= CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
      deleteFile(oldestKey);
    }
  }
}

/**
 * Get a cached response by key
 */
export function getCached(key: string): CachedResponse | undefined {
  return cache.get(key);
}

/**
 * Store a response in the cache (memory + disk)
 */
export function setCached(key: string, entry: CachedResponse): void {
  cache.set(key, entry);
  saveToFile(key, entry);
}

export function recordHit(): void { stats.hits++; }
export function recordMiss(): void { stats.misses++; }
export function recordBypassed(): void { stats.bypassed++; }

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
 * Log cache stats (no-op placeholder kept for call-site compatibility)
 */
export function logCacheStats() {}
