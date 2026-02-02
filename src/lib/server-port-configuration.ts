/**
 * Server Configuration Constants
 *
 * Single source of truth for server-related configuration.
 * Can be overridden by process.env.PORT at runtime.
 */

/** Default server port (can be overridden by process.env.PORT) */
export const DEFAULT_PORT = 8556;

/** Get the current server port from env or default */
export function getPort(): number {
  return parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
}

/** Default server hostname */
export const DEFAULT_HOSTNAME = 'localhost';

/** Get the current hostname */
export function getHostname(): string {
  return process.env.HOST || DEFAULT_HOSTNAME;
}

/** Get server base URL */
export function getServerUrl(): string {
  return `http://${getHostname()}:${getPort()}`;
}
