/**
 * Anthropic Proxy Environment Interceptor
 *
 * Wraps process.env with a Proxy object to intercept writes to ANTHROPIC_BASE_URL.
 * Any attempt to set ANTHROPIC_BASE_URL to a non-proxy value is silently redirected
 * to ANTHROPIC_PROXIED_BASE_URL, keeping ANTHROPIC_BASE_URL locked to the local proxy.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('AnthropicProxyEnvInterceptor');

/**
 * Install the process.env interceptor.
 * After this runs, writes to ANTHROPIC_BASE_URL that don't target our proxy
 * are automatically redirected to ANTHROPIC_PROXIED_BASE_URL.
 *
 * @param proxyUrl - The local proxy URL that ANTHROPIC_BASE_URL must always point to
 */
export function installEnvInterceptor(proxyUrl: string): void {
  const originalEnv = process.env;

  process.env = new Proxy(originalEnv, {
    set(target, prop, value) {
      if (prop === 'ANTHROPIC_BASE_URL') {
        const strValue = String(value);
        if (!strValue.includes('/api/proxy/anthropic')) {
          target.ANTHROPIC_PROXIED_BASE_URL = strValue;
          target.ANTHROPIC_BASE_URL = proxyUrl;
          return true;
        }
      }
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

  log.info({ proxyUrl }, '[AnthropicProxy] process.env interceptor installed');
}

/**
 * Update ANTHROPIC_PROXIED_BASE_URL when config files change,
 * ensuring ANTHROPIC_BASE_URL stays pointed at the proxy.
 */
export function updateProxiedBaseUrl(newBaseUrl: string, proxyUrl: string): void {
  if (newBaseUrl.includes('/api/proxy/anthropic')) return;

  process.env.ANTHROPIC_PROXIED_BASE_URL = newBaseUrl;

  // Access underlying object directly to avoid Proxy interception
  const envObj = process.env as Record<string, string | undefined>;
  if (envObj.ANTHROPIC_BASE_URL !== proxyUrl) {
    envObj.ANTHROPIC_BASE_URL = proxyUrl;
  }
}
