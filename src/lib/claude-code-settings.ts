/**
 * Claude Code CLI Settings Loader
 *
 * Loads LLM config from multiple sources with priority order:
 * 1. Project .claude/.env (highest)
 * 2. ~/.claude/settings.json → env object
 * 3. ~/.claude/.env
 * 4. ~/.claude.json → primaryApiKey
 * 5. ~/.claude/.credentials.json → OAuth (handled by SDK internally, lowest)
 *
 * This is needed because:
 * - Claude CLI reads config files directly
 * - Claude SDK spawns subprocess that inherits process.env
 * - If server started without API key in env, SDK fails
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseDotenv } from 'dotenv';
import { createLogger } from '@/lib/logger';

const log = createLogger('ClaudeCodeSettings');

interface ClaudeCodeSettings {
  env?: Record<string, string>;
}

interface ClaudeJsonConfig {
  primaryApiKey?: string;
}


/**
 * Parse .env file content into key-value pairs
 */
function loadEnvFile(filePath: string): Record<string, string> | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseDotenv(content);
  } catch (error) {
    log.warn({ filePath, error }, `Failed to parse ${filePath}`);
    return null;
  }
}

/**
 * Load Claude Code CLI settings from ~/.claude/settings.json
 */
function loadClaudeCodeSettings(): ClaudeCodeSettings | null {
  const settingsPath = join(homedir(), '.claude', 'settings.json');

  if (!existsSync(settingsPath)) {
    return null;
  }

  try {
    const content = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content) as ClaudeCodeSettings;
  } catch (error) {
    log.warn({ settingsPath, error }, `Failed to parse ${settingsPath}`);
    return null;
  }
}

/**
 * Load Claude Code CLI config from ~/.claude.json (OAuth login API key)
 */
function loadClaudeJsonConfig(): ClaudeJsonConfig | null {
  const configPath = join(homedir(), '.claude.json');

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as ClaudeJsonConfig;
  } catch (error) {
    log.warn({ configPath, error }, `Failed to parse ${configPath}`);
    return null;
  }
}

/**
 * LLM config keys we care about
 */
const LLM_CONFIG_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_PROXIED_BASE_URL',  // Target URL when using proxy
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'API_TIMEOUT_MS',
];

/**
 * Apply Claude Code settings from the highest priority available source
 *
 * Priority order (highest to lowest):
 * 1. ~/.claude/settings.json → env object (SDK uses this, highest priority)
 * 2. Project .claude/.env
 * 3. ~/.claude/.env
 * 4. ~/.claude.json → primaryApiKey
 * 5. ~/.claude/.credentials.json → OAuth (handled by SDK internally)
 *
 * Only uses ONE source (the highest available), doesn't merge from multiple.
 *
 * @param projectPath - Optional project path for project-level .claude/.env
 */
export function applyClaudeCodeSettingsFallback(projectPath?: string): void {
  log.info('Loading LLM config...');

  const homeDir = homedir();
  const userClaudeDir = join(homeDir, '.claude');
  const userSettingsPath = join(userClaudeDir, 'settings.json');
  const userEnvPath = join(userClaudeDir, '.env');
  const claudeJsonPath = join(homeDir, '.claude.json');

  // Priority 1: ~/.claude/settings.json (SDK uses this, highest priority)
  const settings = loadClaudeCodeSettings();
  if (settings?.env && hasValidLLMConfig(settings.env)) {
    applyEnvConfig(settings.env);
    log.info({ path: userSettingsPath }, '✓ Using settings.json');
    logCurrentConfig();
    return;
  }

  // Priority 2: Project .claude/.env
  if (projectPath) {
    const projectEnvPath = join(projectPath, '.claude', '.env');
    const projectEnv = loadEnvFile(projectEnvPath);
    if (projectEnv && hasValidLLMConfig(projectEnv)) {
      applyEnvConfig(projectEnv);
      log.info({ path: projectEnvPath }, '✓ Using project .env');
      logCurrentConfig();
      return;
    }
  }

  // Priority 3: ~/.claude/.env
  const userEnv = loadEnvFile(userEnvPath);
  if (userEnv && hasValidLLMConfig(userEnv)) {
    applyEnvConfig(userEnv);
    log.info({ path: userEnvPath }, '✓ Using user .env');
    logCurrentConfig();
    return;
  }

  // Priority 4: ~/.claude.json primaryApiKey
  const claudeJson = loadClaudeJsonConfig();
  if (claudeJson?.primaryApiKey) {
    process.env.ANTHROPIC_API_KEY = claudeJson.primaryApiKey;
    log.info({ path: claudeJsonPath }, '✓ Using .claude.json (primaryApiKey)');
    logCurrentConfig();
    return;
  }

  // Priority 5: ~/.claude/.credentials.json (OAuth - handled by SDK internally)
  const credentialsPath = join(userClaudeDir, '.credentials.json');
  if (existsSync(credentialsPath)) {
    log.info({ path: credentialsPath }, '✓ Using .credentials.json (OAuth - handled by SDK)');
    return;
  }

  log.info('✗ No LLM config found');
}

/**
 * Check if env object has valid LLM config
 * Valid means either:
 * - ANTHROPIC_API_KEY is set, OR
 * - Both ANTHROPIC_AUTH_TOKEN AND ANTHROPIC_MODEL are set
 */
function hasValidLLMConfig(env: Record<string, string>): boolean {
  // Option 1: API key is sufficient
  if (env.ANTHROPIC_API_KEY) {
    return true;
  }
  // Option 2: Auth token + model are both required
  if (env.ANTHROPIC_AUTH_TOKEN && env.ANTHROPIC_MODEL) {
    return true;
  }
  return false;
}

/**
 * Apply env config to process.env (only LLM keys)
 * Overwrites existing values since caller already determined this is the highest priority source
 */
function applyEnvConfig(env: Record<string, string>): void {
  for (const key of LLM_CONFIG_KEYS) {
    if (env[key]) {
      process.env[key] = env[key];
    }
  }
}

/**
 * Log current LLM config (masked sensitive values)
 */
function logCurrentConfig(): void {
  const configLines: string[] = [];
  for (const key of LLM_CONFIG_KEYS) {
    const value = process.env[key];
    if (value) {
      const masked = key.includes('KEY') || key.includes('TOKEN')
        ? `${value.slice(0, 8)}...${value.slice(-4)}`
        : value;
      configLines.push(`${key}=${masked}`);
    }
  }
  if (configLines.length > 0) {
    log.info({ config: configLines.join(', ') }, 'Config loaded');
  }
}

/**
 * Get LLM env settings merged from all config sources
 * Returns merged env with full priority chain applied
 *
 * @param projectPath - Optional project path for project-level .claude/.env
 */
export function getClaudeCodeEnv(projectPath?: string): Record<string, string> {
  const env: Record<string, string> = {};

  // Apply in priority order (lowest to highest, later overwrites earlier)

  // 4. ~/.claude.json primaryApiKey (lowest)
  const claudeJson = loadClaudeJsonConfig();
  if (claudeJson?.primaryApiKey) {
    env.ANTHROPIC_API_KEY = claudeJson.primaryApiKey;
  }

  // 3. ~/.claude/.env
  const userEnvPath = join(homedir(), '.claude', '.env');
  const userEnv = loadEnvFile(userEnvPath);
  if (userEnv) {
    for (const key of LLM_CONFIG_KEYS) {
      if (userEnv[key]) env[key] = userEnv[key];
    }
  }

  // 2. Project .claude/.env
  if (projectPath) {
    const projectEnvPath = join(projectPath, '.claude', '.env');
    const projectEnv = loadEnvFile(projectEnvPath);
    if (projectEnv) {
      for (const key of LLM_CONFIG_KEYS) {
        if (projectEnv[key]) env[key] = projectEnv[key];
      }
    }
  }

  // 1. ~/.claude/settings.json env object (highest priority - SDK uses this)
  const settings = loadClaudeCodeSettings();
  if (settings?.env) {
    for (const key of LLM_CONFIG_KEYS) {
      if (settings.env[key]) env[key] = settings.env[key];
    }
  }

  return env;
}

/**
 * Get current LLM config as key-value pairs for caching to DB
 */
export function getLLMConfigForCache(): Record<string, string> {
  const config: Record<string, string> = {};
  for (const key of LLM_CONFIG_KEYS) {
    if (process.env[key]) {
      config[key] = process.env[key]!;
    }
  }
  return config;
}

/**
 * Export LLM config keys for external use
 */
export { LLM_CONFIG_KEYS };
