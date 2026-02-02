import { EventEmitter } from 'events';
import ctunnel from 'ctunnel';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPort } from '@/lib/server-port-configuration';
import { createLogger } from '@/lib/logger';

const log = createLogger('TunnelService');

// Health check interval - verify tunnel is still working
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
// Max reconnect attempts before giving up temporarily
const MAX_RECONNECT_ATTEMPTS = 50;
// Consecutive health check failures before forcing reconnect
const HEALTH_CHECK_FAILURE_THRESHOLD = 3;

export type TunnelStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface TunnelState {
  status: TunnelStatus;
  url: string | null;
  error: string | null;
}

interface TunnelOptions {
  subdomain?: string;
  port?: number;
}

class TunnelService extends EventEmitter {
  private tunnel: any = null;
  private state: TunnelState = {
    status: 'disconnected',
    url: null,
    error: null,
  };
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private autoReconnectEnabled = true;
  private lastOptions: TunnelOptions | null = null;
  private isReconnecting = false;
  private healthCheckFailures = 0;

  async start(options?: TunnelOptions): Promise<string> {
    // Use provided port or get from config (which respects process.env.PORT)
    const port = options?.port || getPort();

    // Store options for reconnection
    this.lastOptions = { ...options, port };

    // If already connected and healthy, return existing URL
    if (this.state.status === 'connected' && this.tunnel && !this.tunnel.closed) {
      return this.state.url || '';
    }

    // If connecting, wait a bit for it to complete
    if (this.state.status === 'connecting' && !this.isReconnecting) {
      return this.state.url || '';
    }

    // Clear any pending reconnect
    this.clearReconnectTimeout();

    // Clean up existing tunnel before creating new one
    await this.cleanupTunnel();

    this.setState({ status: 'connecting', error: null });

    try {
      // Get API key from database if exists
      let apiKey = process.env.CTUNNEL_KEY;

      if (!apiKey) {
        const keyRecord = await db
          .select()
          .from(appSettings)
          .where(eq(appSettings.key, 'tunnel_apikey'))
          .limit(1);

        if (keyRecord.length > 0) {
          apiKey = keyRecord[0].value;
        }
      }

      const opts: any = {
        port,
        host: 'https://claude.ws',
      };

      if (apiKey) {
        opts.api_key = apiKey;  // ctunnel expects snake_case: api_key
      }

      if (options?.subdomain) {
        opts.subdomain = options.subdomain;
      }

      log.info({ host: opts.host, port, subdomain: options?.subdomain || 'auto' }, 'Connecting to tunnel');

      this.tunnel = await ctunnel(opts);

      // Set up event handlers with bound context
      this.tunnel.on('error', this.boundHandleTunnelError);
      this.tunnel.on('close', this.boundHandleTunnelClose);

      const url = this.tunnel.url;
      this.setState({ status: 'connected', url, error: null });
      this.emit('connected', { url });
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.healthCheckFailures = 0;

      // Start health check
      this.startHealthCheck();

      log.info({ url }, 'Connected to tunnel');

      return url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error({ error: errorMessage }, 'Connection failed');

      // Clean up partial tunnel state
      this.tunnel = null;

      this.setState({ status: 'error', error: errorMessage });
      this.emit('error', { error: errorMessage });

      // Attempt reconnection with exponential backoff
      this.scheduleReconnect(options);

      throw error;
    }
  }

  // Bound handlers to maintain context
  private boundHandleTunnelError = (err: Error) => {
    this.handleTunnelError(err.message);
  };

  private boundHandleTunnelClose = () => {
    this.handleTunnelClose();
  };

  async stop(): Promise<void> {
    this.clearReconnectTimeout();
    this.stopHealthCheck();

    await this.cleanupTunnel();

    this.setState({ status: 'disconnected', url: null, error: null });
    this.emit('closed');
  }

  /**
   * Clean up tunnel resources without changing state
   */
  private async cleanupTunnel(): Promise<void> {
    if (this.tunnel) {
      try {
        // Remove event listeners to prevent duplicate handling
        this.tunnel.removeListener('error', this.boundHandleTunnelError);
        this.tunnel.removeListener('close', this.boundHandleTunnelClose);
        this.tunnel.close();
      } catch {
        // Ignore close errors
      }
      this.tunnel = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);
    // Don't prevent process from exiting
    this.healthCheckInterval.unref();
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check and return result
   */
  async performHealthCheck(): Promise<{ healthy: boolean; error?: string }> {
    // Get URL from state or construct from stored subdomain
    let tunnelUrl = this.state.url;

    if (!tunnelUrl) {
      // Try to get subdomain from database and update state
      try {
        const subdomainRecord = await db
          .select()
          .from(appSettings)
          .where(eq(appSettings.key, 'tunnel_subdomain'))
          .limit(1);

        if (subdomainRecord.length > 0 && subdomainRecord[0].value) {
          tunnelUrl = `https://${subdomainRecord[0].value}.claude.ws`;
          // Cache the URL in state to avoid repeated DB queries
          this.state.url = tunnelUrl;
        }
      } catch {
        // Ignore DB errors
      }
    }

    // No URL available at all
    if (!tunnelUrl) {
      return { healthy: false, error: 'No tunnel URL available' };
    }

    // Perform HTTP health check
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${tunnelUrl}/api/auth/verify`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Any response (including 401) means tunnel is working
      if (response.ok || response.status === 401) {
        this.healthCheckFailures = 0;
        // Sync state if tunnel is actually working
        if (this.state.status !== 'connected') {
          this.setState({ status: 'connected', url: tunnelUrl, error: null });
        }
        return { healthy: true };
      }

      // Unexpected response - count as failure
      this.healthCheckFailures++;
      const error = `Unexpected response ${response.status}`;

      if (this.healthCheckFailures >= HEALTH_CHECK_FAILURE_THRESHOLD) {
        this.healthCheckFailures = 0;
        this.handleTunnelClose();
      }

      return { healthy: false, error };
    } catch (err) {
      this.healthCheckFailures++;
      const error = err instanceof Error ? err.message : 'Fetch failed';

      if (this.healthCheckFailures >= HEALTH_CHECK_FAILURE_THRESHOLD) {
        this.healthCheckFailures = 0;
        this.handleTunnelClose();
      }

      return { healthy: false, error };
    }
  }

  async tryAutoReconnect(useBackoff = false): Promise<void> {
    if (!this.autoReconnectEnabled) {
      return;
    }

    // Prevent multiple concurrent reconnection attempts
    if (this.isReconnecting) {
      return;
    }

    try {
      // Check if we have existing tunnel configuration in database
      const subdomainRecord = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, 'tunnel_subdomain'))
        .limit(1);

      const apiKeyRecord = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, 'tunnel_apikey'))
        .limit(1);

      const hasSubdomain = subdomainRecord.length > 0 && subdomainRecord[0].value;
      const hasApiKey = apiKeyRecord.length > 0 && apiKeyRecord[0].value;

      if (hasSubdomain && hasApiKey) {
        const subdomain = subdomainRecord[0].value;

        if (useBackoff) {
          // Use scheduled reconnect with exponential backoff
          this.scheduleReconnect({ subdomain });
        } else {
          // Immediate reconnect (e.g., on server startup)
          await this.start({ subdomain });
        }
      }
    } catch {
      // Don't throw - auto-reconnect failure shouldn't crash the app
    }
  }

  disableAutoReconnect(): void {
    this.autoReconnectEnabled = false;
  }

  enableAutoReconnect(): void {
    this.autoReconnectEnabled = true;
  }

  getState(): TunnelState {
    return { ...this.state };
  }

  private setState(newState: Partial<TunnelState>) {
    const oldUrl = this.state.url;
    this.state = { ...this.state, ...newState };
    if (newState.url !== undefined && newState.url !== oldUrl) {
      log.debug({ oldUrl, newUrl: newState.url }, 'setState url change');
    }
    this.emit('status', this.state);
  }

  private handleTunnelError(message: string) {
    log.error({ message }, 'Tunnel error');
    this.setState({ status: 'error', error: message });
    this.emit('error', { error: message });
  }

  private handleTunnelClose() {
    // Prevent duplicate close handling
    if (this.state.status === 'disconnected') {
      return;
    }

    log.info('Connection closed');
    this.stopHealthCheck();
    this.tunnel = null;
    this.setState({ status: 'disconnected', url: null, error: null });
    this.emit('closed');

    // Auto-reconnect with backoff if configuration exists in database
    if (this.autoReconnectEnabled) {
      this.tryAutoReconnect(true);
    }
  }

  private scheduleReconnect(options?: TunnelOptions) {
    // Clear any existing timeout first
    this.clearReconnectTimeout();

    // Check max attempts
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
        await this.start(options);
      } catch {
        // Error already handled in start()
      }
    }, delay);

    // Don't prevent process from exiting
    this.reconnectTimeout.unref();
  }
}

export const tunnelService = new TunnelService();
