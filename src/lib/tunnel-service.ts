import { EventEmitter } from 'events';
import ctunnel from 'ctunnel';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_PORT = 8556;

export type TunnelStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface TunnelState {
  status: TunnelStatus;
  url: string | null;
  error: string | null;
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
  private autoReconnectEnabled = true;

  async start(options?: { subdomain?: string; port?: number }): Promise<string> {
    // Use provided port, env var, or default
    const port = options?.port || (process.env.PORT ? parseInt(process.env.PORT) : DEFAULT_PORT);

    if (this.state.status === 'connected' || this.state.status === 'connecting') {
      return this.state.url || '';
    }

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

      this.tunnel = await ctunnel(opts);

      this.tunnel.on('error', (err: Error) => {
        this.handleTunnelError(err.message);
      });

      this.tunnel.on('close', () => {
        this.handleTunnelClose();
      });

      const url = this.tunnel.url;
      this.setState({ status: 'connected', url, error: null });
      this.emit('connected', { url });
      this.reconnectAttempts = 0;

      return url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.setState({ status: 'error', error: errorMessage });
      this.emit('error', { error: errorMessage });

      // Attempt reconnection with linear backoff
      this.scheduleReconnect(options);

      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.tunnel) {
      try {
        this.tunnel.close();
        this.tunnel = null;
      } catch {
        // Ignore close errors
      }
    }

    this.setState({ status: 'disconnected', url: null, error: null });
    this.emit('closed');
  }

  async tryAutoReconnect(useBackoff = false): Promise<void> {
    if (!this.autoReconnectEnabled) {
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
          // Use scheduled reconnect with linear backoff
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
    this.state = { ...this.state, ...newState };
    this.emit('status', this.state);
  }

  private handleTunnelError(message: string) {
    this.setState({ status: 'error', error: message });
    this.emit('error', { error: message });
  }

  private async handleTunnelClose() {
    this.setState({ status: 'disconnected', url: null, error: null });
    this.emit('closed');

    // Auto-reconnect with backoff if configuration exists in database
    if (this.autoReconnectEnabled) {
      await this.tryAutoReconnect(true);
    }
  }

  private scheduleReconnect(options?: { subdomain?: string; port?: number }) {
    this.reconnectAttempts++;
    // Linear backoff: 1s, 2s, 3s... up to 20s max
    const delay = Math.min(1000 * this.reconnectAttempts, 20000);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.start(options);
      } catch (error) {
        // Error already handled in start()
      }
    }, delay);
  }
}

export const tunnelService = new TunnelService();
