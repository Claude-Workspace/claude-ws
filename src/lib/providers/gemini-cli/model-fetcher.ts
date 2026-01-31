/**
 * Gemini Model Fetcher - Dynamically fetches models from Gemini CLI source
 *
 * Fetches the official model list from:
 * https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/config/models.ts
 *
 * Features:
 * - In-memory caching with 1 hour TTL
 * - Persistent file cache for app restart resilience
 * - Fallback to cached models when fetch fails
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ModelInfo } from '../types';

// Raw GitHub URL for Gemini CLI models configuration
const GEMINI_MODELS_URL = 'https://raw.githubusercontent.com/google-gemini/gemini-cli/main/packages/core/src/config/models.ts';

// Persistent cache file location
const CACHE_DIR = join(homedir(), '.cache', 'claude-kanban');
const CACHE_FILE = join(CACHE_DIR, 'gemini-models.json');

// Fallback models if both fetch and cache fail
const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'auto', name: 'Gemini - Auto', description: 'Automatically selects best model', isDefault: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Advanced reasoning and coding' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and versatile' },
];

// In-memory cache
let cachedModels: ModelInfo[] | null = null;
let lastFetchTime = 0;
let isUsingCachedModels = false;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

interface CacheData {
  models: ModelInfo[];
  timestamp: number;
}

/**
 * Load models from persistent file cache
 */
function loadFromFileCache(): ModelInfo[] | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as CacheData;
    if (data.models && Array.isArray(data.models) && data.models.length > 0) {
      console.log('[GeminiModelFetcher] Loaded', data.models.length, 'models from file cache');
      return data.models;
    }
    return null;
  } catch (error) {
    console.warn('[GeminiModelFetcher] Failed to load file cache:', error);
    return null;
  }
}

/**
 * Save models to persistent file cache
 */
function saveToFileCache(models: ModelInfo[]): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    const data: CacheData = { models, timestamp: Date.now() };
    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    console.log('[GeminiModelFetcher] Saved', models.length, 'models to file cache');
  } catch (error) {
    console.warn('[GeminiModelFetcher] Failed to save file cache:', error);
  }
}

/**
 * Parse model IDs from the TypeScript source file
 */
function parseModelsFromSource(source: string): ModelInfo[] {
  const models: ModelInfo[] = [];

  // Extract model IDs from patterns like:
  // 'gemini-3-pro-preview'
  // 'gemini-2.5-flash'
  // 'auto-gemini-3'
  const modelIdPattern = /'((?:gemini-[\d.]+-(?:pro|flash|flash-lite)(?:-preview)?)|(?:auto(?:-gemini-[\d.]+)?))'/g;
  const matches = source.matchAll(modelIdPattern);
  const seenIds = new Set<string>();

  for (const match of matches) {
    const id = match[1];
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    // Generate display name from ID
    let name = id
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace('Gemini ', 'Gemini ');

    // Clean up names
    if (id === 'auto') {
      name = 'Gemini - Auto';
    } else if (id.startsWith('auto-')) {
      name = name.replace('Auto ', 'Gemini - Auto (') + ')';
    }

    // Determine description
    let description = '';
    if (id === 'auto') {
      description = 'Automatically selects best model';
    } else if (id.includes('preview')) {
      description = 'Preview version';
    } else if (id.includes('pro')) {
      description = 'Most capable';
    } else if (id.includes('flash-lite')) {
      description = 'Lightweight and efficient';
    } else if (id.includes('flash')) {
      description = 'Fast and versatile';
    }

    models.push({
      id,
      name,
      description,
      isDefault: id === 'auto',
    });
  }

  // Sort: auto first, then by version (newest first)
  models.sort((a, b) => {
    if (a.id === 'auto') return -1;
    if (b.id === 'auto') return 1;
    if (a.id.startsWith('auto-')) return -1;
    if (b.id.startsWith('auto-')) return 1;
    // Sort by version number (descending)
    const versionA = a.id.match(/[\d.]+/)?.[0] || '0';
    const versionB = b.id.match(/[\d.]+/)?.[0] || '0';
    return versionB.localeCompare(versionA, undefined, { numeric: true });
  });

  return models;
}

/**
 * Fetch available Gemini models from GitHub source
 */
export async function fetchGeminiModels(): Promise<ModelInfo[]> {
  // Return in-memory cached models if still fresh
  if (cachedModels && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    return cachedModels;
  }

  try {
    console.log('[GeminiModelFetcher] Fetching models from GitHub...');
    const response = await fetch(GEMINI_MODELS_URL, {
      headers: {
        'Accept': 'text/plain',
      },
    });

    if (!response.ok) {
      console.warn('[GeminiModelFetcher] Failed to fetch:', response.status);
      return useCachedOrFallback();
    }

    const source = await response.text();
    const models = parseModelsFromSource(source);

    if (models.length === 0) {
      console.warn('[GeminiModelFetcher] No models parsed, using fallback');
      return useCachedOrFallback();
    }

    // Fresh fetch successful
    cachedModels = models;
    lastFetchTime = Date.now();
    isUsingCachedModels = false;

    // Persist to file cache for next restart
    saveToFileCache(models);

    console.log('[GeminiModelFetcher] Fetched', models.length, 'models:', models.map((m) => m.id).join(', '));
    return models;
  } catch (error) {
    console.error('[GeminiModelFetcher] Error fetching models:', error);
    return useCachedOrFallback();
  }
}

/**
 * Use cached models (in-memory, file cache, or fallback)
 */
function useCachedOrFallback(): ModelInfo[] {
  // Try in-memory cache first
  if (cachedModels && cachedModels.length > 0) {
    isUsingCachedModels = true;
    return cachedModels;
  }

  // Try file cache
  const fileCached = loadFromFileCache();
  if (fileCached) {
    cachedModels = fileCached;
    isUsingCachedModels = true;
    return fileCached;
  }

  // Last resort: hardcoded fallback
  isUsingCachedModels = true;
  return FALLBACK_MODELS;
}

/**
 * Check if currently using cached models (not freshly fetched)
 */
export function isModelsFromCache(): boolean {
  return isUsingCachedModels;
}

/**
 * Clear the models cache (useful for testing or manual refresh)
 */
export function clearModelsCache(): void {
  cachedModels = null;
  lastFetchTime = 0;
}
