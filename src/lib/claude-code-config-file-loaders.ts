/**
 * Claude Code Config File Loaders - Parse settings.json, .env, and .claude.json config files
 *
 * Extracted from claude-code-settings.ts. Each loader reads one config source
 * and returns parsed key-value pairs or null if the file is absent/unreadable.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseDotenv } from 'dotenv';
import { createLogger } from './logger';

const log = createLogger('ClaudeCodeConfigFileLoaders');

export interface ClaudeCodeSettings {
  env?: Record<string, string>;
}

export interface ClaudeJsonConfig {
  primaryApiKey?: string;
}

/**
 * Parse a .env file into key-value pairs. Returns null if missing or unreadable.
 */
export function loadEnvFile(filePath: string): Record<string, string> | null {
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseDotenv(content);
  } catch (error) {
    log.warn({ filePath, error }, `Failed to parse ${filePath}`);
    return null;
  }
}

/**
 * Load ~/.claude/settings.json. Returns null if missing or unreadable.
 */
export function loadClaudeCodeSettings(): ClaudeCodeSettings | null {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return null;
  try {
    const content = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content) as ClaudeCodeSettings;
  } catch (error) {
    log.warn({ settingsPath, error }, `Failed to parse ${settingsPath}`);
    return null;
  }
}

/**
 * Load ~/.claude.json (OAuth login API key). Returns null if missing or unreadable.
 */
export function loadClaudeJsonConfig(): ClaudeJsonConfig | null {
  const configPath = join(homedir(), '.claude.json');
  if (!existsSync(configPath)) return null;
  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as ClaudeJsonConfig;
  } catch (error) {
    log.warn({ configPath, error }, `Failed to parse ${configPath}`);
    return null;
  }
}
