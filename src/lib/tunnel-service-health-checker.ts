/**
 * Tunnel Service Health Checker
 *
 * Handles periodic health checking of the tunnel connection.
 * Polls the tunnel URL and reports failures to trigger reconnection.
 */

import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('TunnelHealthChecker');

// Health check interval - verify tunnel is still working
export const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
// Consecutive health check failures before forcing reconnect
export const HEALTH_CHECK_FAILURE_THRESHOLD = 3;

export interface HealthCheckResult {
  healthy: boolean;
  error?: string;
}

export interface HealthCheckerCallbacks {
  getTunnelUrl: () => string | null;
  getTunnelStatus: () => string;
  onHealthy: (url: string) => void;
  onFailureThresholdReached: () => void;
}

/**
 * Fetch tunnel subdomain from database
 */
export async function fetchTunnelSubdomainFromDb(): Promise<string | null> {
  try {
    const subdomainRecord = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'tunnel_subdomain'))
      .limit(1);

    if (subdomainRecord.length > 0 && subdomainRecord[0].value) {
      return subdomainRecord[0].value;
    }
  } catch {
    // Ignore DB errors
  }
  return null;
}

/**
 * Perform a single HTTP health check against the tunnel URL
 */
export async function checkTunnelUrl(tunnelUrl: string): Promise<HealthCheckResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${tunnelUrl}/api/auth/verify`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Any response (including 401) means tunnel is working
    if (response.ok || response.status === 401) {
      return { healthy: true };
    }

    return { healthy: false, error: `Unexpected response ${response.status}` };
  } catch (err) {
    return { healthy: false, error: err instanceof Error ? err.message : 'Fetch failed' };
  }
}

/**
 * TunnelHealthChecker - manages health check interval and failure counting
 */
export class TunnelHealthChecker {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckFailures = 0;
  private callbacks: HealthCheckerCallbacks;
  private cachedUrl: string | null = null;

  constructor(callbacks: HealthCheckerCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    this.stop();
    this.healthCheckInterval = setInterval(() => {
      this.performCheck();
    }, HEALTH_CHECK_INTERVAL);
    // Don't prevent process from exiting
    this.healthCheckInterval.unref();
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  resetFailures(): void {
    this.healthCheckFailures = 0;
  }

  setCachedUrl(url: string | null): void {
    this.cachedUrl = url;
  }

  getCachedUrl(): string | null {
    return this.cachedUrl;
  }

  /**
   * Perform health check and return result
   */
  async performCheck(): Promise<HealthCheckResult> {
    let tunnelUrl = this.callbacks.getTunnelUrl() || this.cachedUrl;

    if (!tunnelUrl) {
      // Try to get subdomain from database and cache it
      const subdomain = await fetchTunnelSubdomainFromDb();
      if (subdomain) {
        tunnelUrl = `https://${subdomain}.claude.ws`;
        this.cachedUrl = tunnelUrl;
      }
    }

    if (!tunnelUrl) {
      return { healthy: false, error: 'No tunnel URL available' };
    }

    const result = await checkTunnelUrl(tunnelUrl);

    if (result.healthy) {
      this.healthCheckFailures = 0;
      this.callbacks.onHealthy(tunnelUrl);
    } else {
      this.healthCheckFailures++;
      log.warn({ failures: this.healthCheckFailures, error: result.error }, 'Health check failed');

      if (this.healthCheckFailures >= HEALTH_CHECK_FAILURE_THRESHOLD) {
        this.healthCheckFailures = 0;
        this.callbacks.onFailureThresholdReached();
      }
    }

    return result;
  }
}
