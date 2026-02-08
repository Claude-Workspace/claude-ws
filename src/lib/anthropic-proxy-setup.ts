/**
 * Anthropic Proxy Setup
 *
 * Initializes the proxy token cache system by:
 * 1. Moving any existing ANTHROPIC_BASE_URL to ANTHROPIC_PROXIED_BASE_URL
 * 2. Setting ANTHROPIC_BASE_URL to point to the local proxy endpoint
 * 3. Wrapping process.env with a Proxy to intercept future writes
 * 4. Watching config files (.env, ~/.claude/settings.json) for changes
 *
 * This ensures all Anthropic API calls go through our proxy for token caching.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseDotenv } from 'dotenv';

let isInitialized = false;
let proxyUrl = '';

// All config keys we manage
const CONFIG_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_PROXIED_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'API_TIMEOUT_MS',
];

/**
 * Clear all config keys from process.env (including PROXIED_BASE_URL)
 * Only keeps ANTHROPIC_BASE_URL since it points to our proxy
 */
function clearConfigKeys(): void {
  for (const key of CONFIG_KEYS) {
    if (key !== 'ANTHROPIC_BASE_URL') {
      delete process.env[key];
    }
  }
}

/**
 * Load config from app's .env file (including ANTHROPIC_BASE_URL -> PROXIED)
 */
function loadAppEnvConfig(appEnvPath: string): void {
  if (!existsSync(appEnvPath)) return;

  try {
    const content = readFileSync(appEnvPath, 'utf-8');
    const parsed = parseDotenv(content);
    for (const key of CONFIG_KEYS) {
      if (parsed[key]) {
        if (key === 'ANTHROPIC_BASE_URL') {
          // Redirect to PROXIED_BASE_URL
          if (!parsed[key].includes('/api/proxy/anthropic')) {
            process.env.ANTHROPIC_PROXIED_BASE_URL = parsed[key];
          }
        } else {
          process.env[key] = parsed[key];
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
}

/**
 * Load config from ~/.claude.json (console login)
 */
function loadClaudeJsonConfig(): void {
  const claudeJsonPath = join(homedir(), '.claude.json');
  if (!existsSync(claudeJsonPath)) return;

  try {
    const content = readFileSync(claudeJsonPath, 'utf-8');
    const data = JSON.parse(content);
    if (data.primaryApiKey) {
      process.env.ANTHROPIC_API_KEY = data.primaryApiKey;
    }
  } catch {
    // Ignore parse errors
  }
}

import { getPort, getHostname } from './server-port-configuration';

import { createLogger } from './logger';

const log = createLogger('AnthropicProxy');

/**
 * Get the proxy URL based on the current host
 */
function getProxyUrl(): string {
  if (proxyUrl) return proxyUrl;

  proxyUrl = `http://${getHostname()}:${getPort()}/api/proxy/anthropic`;
  return proxyUrl;
}

/**
 * Read ANTHROPIC_BASE_URL from a .env file
 */
function readBaseUrlFromEnv(envPath: string): string | null {
  if (!existsSync(envPath)) return null;

  try {
    const content = readFileSync(envPath, 'utf-8');
    const parsed = parseDotenv(content);
    return parsed.ANTHROPIC_BASE_URL || null;
  } catch {
    return null;
  }
}

/**
 * Read ANTHROPIC_BASE_URL from settings.json
 */
function readBaseUrlFromSettings(settingsPath: string): string | null {
  if (!existsSync(settingsPath)) return null;

  try {
    const content = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    return settings.env?.ANTHROPIC_BASE_URL || null;
  } catch {
    return null;
  }
}

/**
 * Get the user's original CWD (where they ran claude-ws from)
 * This is different from process.cwd() which is packageRoot
 */
function getUserCwd(): string {
  return process.env.CLAUDE_WS_USER_CWD || process.cwd();
}

/**
 * Reload config from all sources by priority when settings.json changes
 * Priority: settings.json > app .env > ~/.claude.json
 */
function reloadSettingsConfig(settingsPath: string): void {
  const localProxyUrl = getProxyUrl();
  const appEnvPath = join(getUserCwd(), '.env');

  // Clear existing config keys first
  clearConfigKeys();

  // Try to load from settings.json (highest priority)
  let hasSettingsConfig = false;
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);
      const env = settings.env;

      if (env && typeof env === 'object') {
        // Check if settings.json has valid config
        if (env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY) {
          hasSettingsConfig = true;
          // Apply all config keys from settings.json
          for (const key of CONFIG_KEYS) {
            if (env[key]) {
              if (key === 'ANTHROPIC_BASE_URL') {
                // Redirect to PROXIED and keep proxy URL
                if (!env[key].includes('/api/proxy/anthropic')) {
                  process.env.ANTHROPIC_PROXIED_BASE_URL = env[key];
                }
              } else {
                process.env[key] = env[key];
              }
            }
          }
        }
      }
    } catch (err) {
      log.warn({ data: err }, '[AnthropicProxy] Failed to parse settings.json:');
    }
  }

  // If no settings.json config, fall back to lower priority sources
  if (!hasSettingsConfig) {
    // Try app's .env (2nd priority)
    if (existsSync(appEnvPath)) {
      try {
        const content = readFileSync(appEnvPath, 'utf-8');
        const parsed = parseDotenv(content);
        if (parsed.ANTHROPIC_AUTH_TOKEN || parsed.ANTHROPIC_API_KEY) {
          loadAppEnvConfig(appEnvPath);
          return;
        }
      } catch {
        // Ignore
      }
    }

    // Try ~/.claude.json (3rd priority)
    loadClaudeJsonConfig();
    if (process.env.ANTHROPIC_API_KEY) {
      return;
    }

  }
}

/**
 * Update ANTHROPIC_PROXIED_BASE_URL when config files change
 */
function updateProxiedBaseUrl(newBaseUrl: string): void {
  const localProxyUrl = getProxyUrl();

  // Skip if it's already our proxy URL
  if (newBaseUrl.includes('/api/proxy/anthropic')) {
    return;
  }

  // Update the proxied base URL
  process.env.ANTHROPIC_PROXIED_BASE_URL = newBaseUrl;

  // Ensure ANTHROPIC_BASE_URL still points to proxy
  // Access underlying object directly to avoid Proxy interception
  const envObj = process.env as Record<string, string | undefined>;
  if (envObj.ANTHROPIC_BASE_URL !== localProxyUrl) {
    envObj.ANTHROPIC_BASE_URL = localProxyUrl;
  }
}

/**
 * Initialize the Anthropic proxy environment variables
 * Uses a Proxy wrapper on process.env to intercept future writes
 */
export function initAnthropicProxy(): void {
  if (isInitialized) {
    return;
  }

  const localProxyUrl = getProxyUrl();
  const claudeSettingsPath = join(homedir(), '.claude', 'settings.json');

  // Load config with correct priority: settings.json > app .env > ~/.claude.json
  // This ensures settings.json has highest priority from the start
  reloadSettingsConfig(claudeSettingsPath);

  // Handle ANTHROPIC_BASE_URL -> PROXIED redirection
  // Only if ANTHROPIC_PROXIED_BASE_URL wasn't already set by reloadSettingsConfig
  const currentBaseUrl = process.env.ANTHROPIC_BASE_URL;
  if (currentBaseUrl && !currentBaseUrl.includes('/api/proxy/anthropic') && !process.env.ANTHROPIC_PROXIED_BASE_URL) {
    process.env.ANTHROPIC_PROXIED_BASE_URL = currentBaseUrl;
  }

  // Set ANTHROPIC_BASE_URL to our proxy
  process.env.ANTHROPIC_BASE_URL = localProxyUrl;

  // Wrap process.env with Proxy to intercept future writes to ANTHROPIC_BASE_URL
  const originalEnv = process.env;
  process.env = new Proxy(originalEnv, {
    set(target, prop, value) {
      // Intercept writes to ANTHROPIC_BASE_URL
      if (prop === 'ANTHROPIC_BASE_URL') {
        const strValue = String(value);
        // If trying to set to something other than our proxy, redirect to PROXIED
        if (!strValue.includes('/api/proxy/anthropic')) {
          target.ANTHROPIC_PROXIED_BASE_URL = strValue;
          // Keep ANTHROPIC_BASE_URL pointing to proxy
          target.ANTHROPIC_BASE_URL = localProxyUrl;
          return true;
        }
      }
      // Default behavior for all other properties
      target[prop as string] = value;
      return true;
    },
    get(target, prop) {
      return target[prop as string];
    },
    deleteProperty(target, prop) {
      delete target[prop as string];
      return true;
    },
    has(target, prop) {
      return prop in target;
    },
    ownKeys(target) {
      return Object.keys(target);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Object.getOwnPropertyDescriptor(target, prop as string);
    },
  });

  // Note: File watching removed - config is now reloaded via API endpoint calls
  isInitialized = true;
}

/**
 * Check if proxy is initialized
 */
export function isProxyInitialized(): boolean {
  return isInitialized;
}

/**
 * Get current proxy configuration
 */
export function getProxyConfig(): {
  proxyUrl: string;
  targetUrl: string;
  isInitialized: boolean;
} {
  return {
    proxyUrl: process.env.ANTHROPIC_BASE_URL || getProxyUrl(),
    targetUrl: process.env.ANTHROPIC_PROXIED_BASE_URL || 'https://api.anthropic.com',
    isInitialized,
  };
}

/**
 * Reload config from all sources by priority
 * Call this after dismissing app's .env config to load from next priority source
 */
export function reloadConfigByPriority(): void {
  const claudeSettingsPath = join(homedir(), '.claude', 'settings.json');
  reloadSettingsConfig(claudeSettingsPath);
}
