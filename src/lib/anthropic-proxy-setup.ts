/**
 * Anthropic Proxy Setup
 *
 * Initializes the proxy token cache system by:
 * 1. Moving any existing ANTHROPIC_BASE_URL to ANTHROPIC_PROXIED_BASE_URL
 * 2. Setting ANTHROPIC_BASE_URL to point to the local proxy endpoint
 * 3. Wrapping process.env with a Proxy to intercept future writes
 *
 * This ensures all Anthropic API calls go through our proxy for token caching.
 */

import { join } from 'path';
import { homedir } from 'os';
import { getPort, getHostname } from '@/lib/server-port-configuration';
import { createLogger } from '@/lib/logger';
import { reloadSettingsConfig } from '@/lib/anthropic-proxy-config-loader';
import { installEnvInterceptor } from '@/lib/anthropic-proxy-env-interceptor';

const log = createLogger('AnthropicProxy');

let isInitialized = false;
let proxyUrl = '';

/**
 * Get the proxy URL based on the current host (memoized)
 */
function getProxyUrl(): string {
  if (proxyUrl) return proxyUrl;
  proxyUrl = `http://${getHostname()}:${getPort()}/api/proxy/anthropic`;
  return proxyUrl;
}

/**
 * Initialize the Anthropic proxy environment variables.
 * Uses a Proxy wrapper on process.env to intercept future writes to ANTHROPIC_BASE_URL.
 */
export function initAnthropicProxy(): void {
  if (isInitialized) return;

  const localProxyUrl = getProxyUrl();
  const claudeSettingsPath = join(homedir(), '.claude', 'settings.json');

  // Load config with correct priority: settings.json > app .env > ~/.claude.json
  reloadSettingsConfig(claudeSettingsPath, localProxyUrl);

  // Handle ANTHROPIC_BASE_URL -> PROXIED redirection
  // Only if ANTHROPIC_PROXIED_BASE_URL wasn't already set by reloadSettingsConfig
  const currentBaseUrl = process.env.ANTHROPIC_BASE_URL;
  if (currentBaseUrl && !currentBaseUrl.includes('/api/proxy/anthropic') && !process.env.ANTHROPIC_PROXIED_BASE_URL) {
    process.env.ANTHROPIC_PROXIED_BASE_URL = currentBaseUrl;
  }

  // Set ANTHROPIC_BASE_URL to our proxy
  process.env.ANTHROPIC_BASE_URL = localProxyUrl;
  log.info({ localProxyUrl }, '[AnthropicProxy] ANTHROPIC_BASE_URL set to proxy');

  // Wrap process.env with Proxy to intercept future writes to ANTHROPIC_BASE_URL
  installEnvInterceptor(localProxyUrl);

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
 * Reload config from all sources by priority.
 * Call this after dismissing app's .env config to load from next priority source.
 */
export function reloadConfigByPriority(): void {
  const claudeSettingsPath = join(homedir(), '.claude', 'settings.json');
  reloadSettingsConfig(claudeSettingsPath, getProxyUrl());
}
