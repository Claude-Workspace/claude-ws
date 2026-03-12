import { EventEmitter } from 'events';
import ctunnel from 'ctunnel';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPort } from '@/lib/server-port-configuration';
import { createLogger } from '@/lib/logger';
import { TunnelHealthChecker } from '@/lib/tunnel-service-health-checker';
import { TunnelReconnectionManager } from '@/lib/tunnel-service-reconnection-manager';

const log = createLogger('TunnelService');

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
  private state: TunnelState = { status: 'disconnected', url: null, error: null };
  private lastOptions: TunnelOptions | null = null;
  private healthChecker: TunnelHealthChecker;
  private reconnectionManager: TunnelReconnectionManager;

  constructor() {
    super();

    this.healthChecker = new TunnelHealthChecker({
      getTunnelUrl: () => this.state.url,
      getTunnelStatus: () => this.state.status,
      onHealthy: (url) => {
        if (this.state.status !== 'connected') {
          this.setState({ status: 'connected', url, error: null });
        }
      },
      onFailureThresholdReached: () => this.handleTunnelClose(),
    });

    this.reconnectionManager = new TunnelReconnectionManager({
      onReconnect: (options) => this.start(options),
    });
  }

  async start(options?: TunnelOptions): Promise<string> {
    const port = options?.port || getPort();
    this.lastOptions = { ...options, port };

    if (this.state.status === 'connected' && this.tunnel && !this.tunnel.closed) {
      return this.state.url || '';
    }

    if (this.state.status === 'connecting' && !this.reconnectionManager.isActive) {
      return this.state.url || '';
    }

    this.reconnectionManager.clearTimeout();
    await this.cleanupTunnel();
    this.setState({ status: 'connecting', error: null });

    try {
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

      const opts: any = { port, host: 'https://claude.ws' };
      if (apiKey) opts.api_key = apiKey;
      if (options?.subdomain) opts.subdomain = options.subdomain;

      log.info({ host: opts.host, port, subdomain: options?.subdomain || 'auto' }, 'Connecting to tunnel');

      this.tunnel = await ctunnel(opts);
      this.tunnel.on('error', this.boundHandleTunnelError);
      this.tunnel.on('close', this.boundHandleTunnelClose);

      const url = this.tunnel.url;
      this.setState({ status: 'connected', url, error: null });
      this.emit('connected', { url });
      this.reconnectionManager.resetAttempts();
      this.healthChecker.resetFailures();
      this.healthChecker.start();

      log.info({ url }, 'Connected to tunnel');
      return url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error({ error: errorMessage }, 'Connection failed');
      this.tunnel = null;
      this.setState({ status: 'error', error: errorMessage });
      this.emit('error', { error: errorMessage });
      this.reconnectionManager.scheduleReconnect(options);
      throw error;
    }
  }

  private boundHandleTunnelError = (err: Error) => {
    log.error({ message: err.message }, 'Tunnel error');
    this.setState({ status: 'error', error: err.message });
    this.emit('error', { error: err.message });
  };

  private boundHandleTunnelClose = () => {
    this.handleTunnelClose();
  };

  async stop(): Promise<void> {
    this.reconnectionManager.clearTimeout();
    this.healthChecker.stop();
    await this.cleanupTunnel();
    this.setState({ status: 'disconnected', url: null, error: null });
    this.emit('closed');
  }

  private async cleanupTunnel(): Promise<void> {
    if (this.tunnel) {
      try {
        this.tunnel.removeListener('error', this.boundHandleTunnelError);
        this.tunnel.removeListener('close', this.boundHandleTunnelClose);
        this.tunnel.close();
      } catch {
        // Ignore close errors
      }
      this.tunnel = null;
    }
  }

  /**
   * Perform health check and return result (used by API routes)
   */
  async performHealthCheck() {
    return this.healthChecker.performCheck();
  }

  async tryAutoReconnect(useBackoff = false): Promise<void> {
    return this.reconnectionManager.tryAutoReconnect(useBackoff);
  }

  disableAutoReconnect(): void {
    this.reconnectionManager.disableAutoReconnect();
  }

  enableAutoReconnect(): void {
    this.reconnectionManager.enableAutoReconnect();
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

  private handleTunnelClose() {
    if (this.state.status === 'disconnected') return;

    log.info('Connection closed');
    this.healthChecker.stop();
    this.tunnel = null;
    this.setState({ status: 'disconnected', url: null, error: null });
    this.emit('closed');

    if (this.reconnectionManager.isAutoReconnectEnabled()) {
      this.reconnectionManager.tryAutoReconnect(true);
    }
  }
}

export const tunnelService = new TunnelService();
