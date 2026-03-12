/**
 * Tunnel Service Reconnection Manager
 *
 * Handles exponential-backoff reconnection scheduling and auto-reconnect
 * logic using tunnel configuration stored in the database.
 */

import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('TunnelReconnectionManager');

// Max reconnect attempts before giving up temporarily
export const MAX_RECONNECT_ATTEMPTS = 50;

export interface ReconnectOptions {
  subdomain?: string;
  port?: number;
}

export interface ReconnectionCallbacks {
  onReconnect: (options?: ReconnectOptions) => Promise<unknown>;
}

/**
 * Fetch tunnel credentials from the database
 */
export async function fetchTunnelCredentialsFromDb(): Promise<{
  subdomain: string | null;
  apiKey: string | null;
}> {
  const [subdomainRecord, apiKeyRecord] = await Promise.all([
    db.select().from(appSettings).where(eq(appSettings.key, 'tunnel_subdomain')).limit(1),
    db.select().from(appSettings).where(eq(appSettings.key, 'tunnel_apikey')).limit(1),
  ]);

  return {
    subdomain: subdomainRecord.length > 0 ? subdomainRecord[0].value : null,
    apiKey: apiKeyRecord.length > 0 ? apiKeyRecord[0].value : null,
  };
}

/**
 * TunnelReconnectionManager - manages reconnect attempts with exponential backoff
 */
export class TunnelReconnectionManager {
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private autoReconnectEnabled = true;
  private callbacks: ReconnectionCallbacks;

  constructor(callbacks: ReconnectionCallbacks) {
    this.callbacks = callbacks;
  }

  get isActive(): boolean {
    return this.isReconnecting;
  }

  resetAttempts(): void {
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
  }

  clearTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  disableAutoReconnect(): void {
    this.autoReconnectEnabled = false;
  }

  enableAutoReconnect(): void {
    this.autoReconnectEnabled = true;
  }

  isAutoReconnectEnabled(): boolean {
    return this.autoReconnectEnabled;
  }

  /**
   * Schedule a reconnect attempt with exponential backoff
   */
  scheduleReconnect(options?: ReconnectOptions): void {
    this.clearTimeout();

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log.error({ maxAttempts: MAX_RECONNECT_ATTEMPTS }, 'Max reconnect attempts reached, stopping auto-reconnect');
      this.reconnectAttempts = 0;
      // Wait 5 minutes before allowing reconnect attempts again
      setTimeout(() => {
        log.info('Resetting reconnect counter after cooldown');
        this.reconnectAttempts = 0;
      }, 5 * 60 * 1000).unref();
      return;
    }

    this.reconnectAttempts++;
    this.isReconnecting = true;

    // Exponential backoff: 1s, 2s, 4s, 8s... up to 30s max
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

    log.info({ attempt: this.reconnectAttempts, delayMs: delay }, 'Scheduling reconnect');

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.callbacks.onReconnect(options);
      } catch {
        // Error already handled in start()
      }
    }, delay);

    // Don't prevent process from exiting
    this.reconnectTimeout.unref();
  }

  /**
   * Attempt auto-reconnect using stored database config
   */
  async tryAutoReconnect(useBackoff = false): Promise<void> {
    if (!this.autoReconnectEnabled) return;
    if (this.isReconnecting) return;

    try {
      const { subdomain, apiKey } = await fetchTunnelCredentialsFromDb();

      if (subdomain && apiKey) {
        if (useBackoff) {
          this.scheduleReconnect({ subdomain });
        } else {
          await this.callbacks.onReconnect({ subdomain });
        }
      }
    } catch {
      // Don't throw - auto-reconnect failure shouldn't crash the app
    }
  }
}
