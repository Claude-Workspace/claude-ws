/**
 * Centralized Pino Logger Utility
 *
 * Environment-aware logging with:
 * - Development: Pretty-printed colorized output (debug level)
 * - Production: JSON structured logs, respects LOG_LEVEL env var
 *
 * Usage:
 *   import { createLogger } from './logger';
 *   const log = createLogger('ModuleName');
 *   log.info('message');
 *   log.error({ err }, 'Error occurred');
 */

// Use require for pino to avoid esModuleInterop issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pino = require('pino');

// Environment detection
const isDev = process.env.NODE_ENV !== 'production';

// Log level priority: LOG_LEVEL env > auto-detect based on NODE_ENV
// Levels: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
const level = process.env.LOG_LEVEL || (isDev ? 'debug' : 'warn');

// Logger interface matching pino's Logger type
export interface Logger {
  fatal: (obj: object | string, msg?: string) => void;
  error: (obj: object | string, msg?: string) => void;
  warn: (obj: object | string, msg?: string) => void;
  info: (obj: object | string, msg?: string) => void;
  debug: (obj: object | string, msg?: string) => void;
  trace: (obj: object | string, msg?: string) => void;
  child: (bindings: object) => Logger;
}

/**
 * Base logger instance
 *
 * In development: pino-pretty for human-readable colored output
 * In production: JSON output for structured logging (e.g., for log aggregators)
 */
export const logger: Logger = pino({
  level,
  // pino-pretty transport only in development
  // In production, outputs raw JSON (faster, structured)
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

/**
 * Create a child logger with module context
 *
 * Preserves existing [ModuleName] prefix pattern as structured `module` field
 *
 * @param module - Module name (e.g., 'Server', 'AgentManager', 'SDK Adapter')
 * @returns Child logger with module context
 *
 * @example
 * const log = createLogger('Server');
 * log.info('Starting server...');
 * // Dev output: [HH:MM:ss] INFO (Server): Starting server...
 * // Prod output: {"level":30,"module":"Server","msg":"Starting server..."}
 */
export const createLogger = (module: string): Logger => {
  return logger.child({ module });
};
