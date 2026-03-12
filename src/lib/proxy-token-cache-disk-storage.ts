/**
 * Proxy Token Cache Disk Storage
 *
 * Handles reading and writing token cache entries to/from the filesystem.
 * Separates disk I/O from the in-memory cache logic in proxy-token-cache.ts.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@/lib/logger';
import type { CachedResponse } from '@/lib/proxy-token-cache';

const log = createLogger('ProxyTokenCacheDiskStorage');

const DATA_DIR = process.env.DATA_DIR || './data';
export const CACHE_DIR = join(DATA_DIR, 'token-cache');

// Ensure cache directory exists on module load
try {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (err) {
  log.warn({ data: err }, '[ProxyTokenCache] Failed to create cache directory:');
}

/**
 * Get the file path for a cache key
 */
export function getCacheFilePath(key: string): string {
  return join(CACHE_DIR, `${key}.json`);
}

/**
 * Load a single cache entry from disk. Returns null if missing or unreadable.
 */
export function loadFromFile(key: string): CachedResponse | null {
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
 * Save a cache entry to disk
 */
export function saveToFile(key: string, entry: CachedResponse): void {
  try {
    writeFileSync(getCacheFilePath(key), JSON.stringify(entry), 'utf-8');
  } catch (err) {
    log.warn({ data: err }, '[ProxyTokenCache] Failed to save cache file:');
  }
}

/**
 * Delete a cache file from disk
 */
export function deleteFile(key: string): void {
  try {
    const filePath = getCacheFilePath(key);
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // Ignore deletion errors
  }
}

/**
 * Load all non-expired cache entries from disk into the provided map.
 * Deletes expired entries from disk. Returns loaded and expired counts.
 */
export function loadAllFromDisk(
  cache: Map<string, CachedResponse>,
  isExpired: (entry: CachedResponse) => boolean,
): void {
  try {
    if (!existsSync(CACHE_DIR)) return;
    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const key = file.replace('.json', '');
      const entry = loadFromFile(key);
      if (!entry) continue;

      if (isExpired(entry)) {
        deleteFile(key);
      } else {
        cache.set(key, entry);
      }
    }
  } catch (err) {
    log.warn({ data: err }, '[ProxyTokenCache] Failed to load cache from disk:');
  }
}
