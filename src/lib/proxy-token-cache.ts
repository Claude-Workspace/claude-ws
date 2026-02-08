/**
 * Proxy Token Cache - Shared cache module for count_tokens responses
 *
 * This module provides the caching logic used by the Anthropic proxy endpoint.
 * It's separated from the route to allow importing from server.ts without
 * Next.js AsyncLocalStorage issues.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

import { createLogger } from './logger';

const log = createLogger('ProxyTokenCache');

// Cache configuration
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cache directory
const DATA_DIR = process.env.DATA_DIR || './data';
const CACHE_DIR = join(DATA_DIR, 'token-cache');

// Ensure cache directory exists
try {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (err) {
  log.warn({ data: err }, '[ProxyTokenCache] Failed to create cache directory:');
}

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
const stats = {
  hits: 0,
  misses: 0,
  bypassed: 0,
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
    log.warn({ data: err }, '[ProxyTokenCache] Failed to save cache file:');
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
    }
  } catch (err) {
    log.warn({ data: err }, '[ProxyTokenCache] Failed to load cache from disk:');
  }
}

// Load cache from disk on module load
loadCacheFromDisk();

/**
 * Generate cache key from request body
 */
export function generateCacheKey(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const hashInput = JSON.stringify({
      model: parsed.model,
      tools: parsed.tools,
    });
    return createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
  } catch {
    return createHash('sha256').update(body).digest('hex').slice(0, 16);
  }
}

/**
 * Check if cached entry has expired
 */
export function isExpired(entry: CachedResponse): boolean {
  return Date.now() - entry.cachedAt > CACHE_TTL_MS;
}

/**
 * Evict oldest entry if cache is full
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
 * Get cached response
 */
export function getCached(key: string): CachedResponse | undefined {
  return cache.get(key);
}

/**
 * Set cached response
 */
export function setCached(key: string, entry: CachedResponse): void {
  cache.set(key, entry);
  saveToFile(key, entry);
}

/**
 * Record a cache hit
 */
export function recordHit(): void {
  stats.hits++;
}

/**
 * Record a cache miss
 */
export function recordMiss(): void {
  stats.misses++;
}

/**
 * Record a bypassed request
 */
export function recordBypassed(): void {
  stats.bypassed++;
}

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
 * Log cache stats
 */
export function logCacheStats() {
}
