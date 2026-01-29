declare module 'ctunnel' {
  interface TunnelOptions {
    port: number;
    host?: string;
    subdomain?: string;
  }

  interface Tunnel {
    url: string;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    close(): void;
  }

  function ctunnel(opts: TunnelOptions): Promise<Tunnel>;

  export default ctunnel;
}
