/**
 * Anthropic Proxy Config Loader
 *
 * Loads Anthropic API configuration from multiple sources with priority ordering:
 * 1. ~/.claude/settings.json (highest)
 * 2. App .env file
 * 3. ~/.claude.json (console login, lowest)
 *
 * Handles ANTHROPIC_BASE_URL → ANTHROPIC_PROXIED_BASE_URL redirection so all
 * Anthropic API calls are routed through the local proxy endpoint.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseDotenv } from 'dotenv';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnthropicProxyConfigLoader');

// All config keys managed by the proxy setup
export const CONFIG_KEYS = [
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
 * Clear all managed config keys from process.env, keeping only ANTHROPIC_BASE_URL
 * (which must stay pointed at the proxy)
 */
export function clearConfigKeys(): void {
  for (const key of CONFIG_KEYS) {
    if (key !== 'ANTHROPIC_BASE_URL') {
      delete process.env[key];
    }
  }
}

/**
 * Load config from the app's .env file.
 * Redirects ANTHROPIC_BASE_URL → ANTHROPIC_PROXIED_BASE_URL.
 */
export function loadAppEnvConfig(appEnvPath: string): void {
  if (!existsSync(appEnvPath)) return;

  try {
    const content = readFileSync(appEnvPath, 'utf-8');
    const parsed = parseDotenv(content);
    for (const key of CONFIG_KEYS) {
      if (parsed[key]) {
        if (key === 'ANTHROPIC_BASE_URL') {
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
 * Load API key from ~/.claude.json (set by console login)
 */
export function loadClaudeJsonConfig(): void {
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

/**
 * Read ANTHROPIC_BASE_URL from a .env file
 */
export function readBaseUrlFromEnv(envPath: string): string | null {
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
 * Read ANTHROPIC_BASE_URL from a settings.json file
 */
export function readBaseUrlFromSettings(settingsPath: string): string | null {
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
 * Get the user's original CWD (where they ran claude-ws from).
 * Different from process.cwd() which is packageRoot.
 */
export function getUserCwd(): string {
  return process.env.CLAUDE_WS_USER_CWD || process.cwd();
}

/**
 * Reload config from all sources by priority when settings.json changes.
 * Priority: settings.json > app .env > ~/.claude.json
 */
export function reloadSettingsConfig(settingsPath: string, proxyUrl: string): void {
  const appEnvPath = join(getUserCwd(), '.env');

  clearConfigKeys();

  let hasSettingsConfig = false;
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);
      const env = settings.env;

      if (env && typeof env === 'object' && (env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY)) {
        hasSettingsConfig = true;
        for (const key of CONFIG_KEYS) {
          if (env[key]) {
            if (key === 'ANTHROPIC_BASE_URL') {
              if (!env[key].includes('/api/proxy/anthropic')) {
                process.env.ANTHROPIC_PROXIED_BASE_URL = env[key];
              }
            } else {
              process.env[key] = env[key];
            }
          }
        }
      }
    } catch (err) {
      log.warn({ data: err }, '[AnthropicProxy] Failed to parse settings.json:');
    }
  }

  if (!hasSettingsConfig) {
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

    loadClaudeJsonConfig();
  }
}
