/**
 * Model Cache - Persistent caching utility for provider models
 *
 * Provides file-based caching for model lists that survives app restarts.
 * Each provider can use this to cache their models independently.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ModelInfo } from './types';

// Persistent cache directory
const CACHE_DIR = join(homedir(), '.cache', 'claude-kanban', 'models');

interface CacheData {
  models: ModelInfo[];
  timestamp: number;
}

/**
 * Get cache file path for a provider
 */
function getCacheFilePath(providerId: string): string {
  return join(CACHE_DIR, `${providerId}.json`);
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load models from file cache for a provider
 */
export function loadModelsFromCache(providerId: string): ModelInfo[] | null {
  try {
    const filePath = getCacheFilePath(providerId);
    if (!existsSync(filePath)) return null;

    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as CacheData;
    if (data.models && Array.isArray(data.models) && data.models.length > 0) {
      console.log(`[ModelCache:${providerId}] Loaded ${data.models.length} models from cache`);
      return data.models;
    }
    return null;
  } catch (error) {
    console.warn(`[ModelCache:${providerId}] Failed to load cache:`, error);
    return null;
  }
}

/**
 * Save models to file cache for a provider
 */
export function saveModelsToCache(providerId: string, models: ModelInfo[]): void {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(providerId);
    const data: CacheData = { models, timestamp: Date.now() };
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`[ModelCache:${providerId}] Saved ${models.length} models to cache`);
  } catch (error) {
    console.warn(`[ModelCache:${providerId}] Failed to save cache:`, error);
  }
}

/**
 * Clear cache for a provider
 */
export function clearModelCache(providerId: string): void {
  try {
    const filePath = getCacheFilePath(providerId);
    if (existsSync(filePath)) {
      const { unlinkSync } = require('fs');
      unlinkSync(filePath);
      console.log(`[ModelCache:${providerId}] Cache cleared`);
    }
  } catch (error) {
    console.warn(`[ModelCache:${providerId}] Failed to clear cache:`, error);
  }
}

/**
 * Model fetcher state tracking
 */
interface ModelFetcherState {
  cachedModels: ModelInfo[] | null;
  lastFetchTime: number;
  isUsingCachedModels: boolean;
}

const fetcherStates = new Map<string, ModelFetcherState>();

/**
 * Get or create fetcher state for a provider
 */
function getFetcherState(providerId: string): ModelFetcherState {
  let state = fetcherStates.get(providerId);
  if (!state) {
    state = { cachedModels: null, lastFetchTime: 0, isUsingCachedModels: false };
    fetcherStates.set(providerId, state);
  }
  return state;
}

/**
 * Create a model fetcher with caching for a provider
 */
export function createCachedModelFetcher(
  providerId: string,
  fetchFn: () => Promise<ModelInfo[]>,
  fallbackModels: ModelInfo[],
  cacheTtlMs: number = 60 * 60 * 1000 // 1 hour default
) {
  const state = getFetcherState(providerId);

  return {
    /**
     * Fetch models with caching
     */
    async fetchModels(): Promise<ModelInfo[]> {
      // Return in-memory cached models if still fresh
      if (state.cachedModels && Date.now() - state.lastFetchTime < cacheTtlMs) {
        return state.cachedModels;
      }

      try {
        const models = await fetchFn();

        if (models.length === 0) {
          return this.useCachedOrFallback();
        }

        // Fresh fetch successful
        state.cachedModels = models;
        state.lastFetchTime = Date.now();
        state.isUsingCachedModels = false;

        // Persist to file cache
        saveModelsToCache(providerId, models);

        return models;
      } catch (error) {
        console.error(`[ModelFetcher:${providerId}] Fetch error:`, error);
        return this.useCachedOrFallback();
      }
    },

    /**
     * Use cached models or fallback
     */
    useCachedOrFallback(): ModelInfo[] {
      // Try in-memory cache first
      if (state.cachedModels && state.cachedModels.length > 0) {
        state.isUsingCachedModels = true;
        return state.cachedModels;
      }

      // Try file cache
      const fileCached = loadModelsFromCache(providerId);
      if (fileCached) {
        state.cachedModels = fileCached;
        state.isUsingCachedModels = true;
        return fileCached;
      }

      // Last resort: fallback models
      state.isUsingCachedModels = true;
      return fallbackModels;
    },

    /**
     * Check if using cached models
     */
    isFromCache(): boolean {
      return state.isUsingCachedModels;
    },

    /**
     * Clear cache
     */
    clearCache(): void {
      state.cachedModels = null;
      state.lastFetchTime = 0;
      state.isUsingCachedModels = false;
      clearModelCache(providerId);
    },
  };
}
