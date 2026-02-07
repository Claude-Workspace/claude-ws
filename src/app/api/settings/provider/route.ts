import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { agentManager } from '@/lib/agent-manager';
import { reloadConfigByPriority } from '@/lib/anthropic-proxy-setup';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProviderSettingsAPI');

// Configuration keys we handle
const CONFIG_KEYS = [
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
 * Get the user's original CWD (where they ran claude-ws from)
 */
function getUserCwd(): string {
  return process.env.CLAUDE_WS_USER_CWD || process.cwd();
}

/**
 * Get the app root directory for saving .env
 * Supports: development, production, and Docker deployments
 */
function getAppRoot(): string {
  // 1. Explicit environment variable (highest priority - for Docker/custom deployments)
  if (process.env.APP_ROOT && existsSync(process.env.APP_ROOT)) {
    return process.env.APP_ROOT;
  }

  // 2. Common Docker app directory
  if (existsSync('/app/package.json')) {
    return '/app';
  }

  // 3. User's original CWD - where they ran `claude-ws` from
  const userCwd = getUserCwd();
  if (userCwd !== process.cwd() || existsSync(join(userCwd, '.env'))) {
    return userCwd;
  }

  // 4. Fallback to process.cwd() (packageRoot in global install, project root in dev)
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'package.json'))) {
    return cwd;
  }

  // 5. Walk up from __dirname to find package.json (development fallback)
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 6. Final fallback to cwd (even without package.json)
  log.warn({ cwd }, 'Could not find package.json, using cwd');
  return cwd;
}

/**
 * POST /api/settings/provider
 * Save Anthropic configuration to project's .env file
 */
export async function POST(request: NextRequest) {
  try {
    // Reload config to pick up any external changes (e.g., ~/.claude/settings.json)
    reloadConfigByPriority();

    const body = await request.json();
    const { config, skipKeyIfMissing } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: 'Configuration object is required' },
        { status: 400 }
      );
    }

    const authToken = config.ANTHROPIC_AUTH_TOKEN;
    // Auth token is required unless skipKeyIfMissing is true (existing key will be kept)
    if (!skipKeyIfMissing && (!authToken || typeof authToken !== 'string')) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Get app root and .env path
    const appRoot = getAppRoot();
    const envPath = join(appRoot, '.env');

    // Read existing .env content if it exists
    let existingLines: string[] = [];
    if (existsSync(envPath)) {
      const existingContent = readFileSync(envPath, 'utf-8');
      existingLines = existingContent.split('\n');
    }

    // Build a map of existing keys
    const existingKeys = new Map<string, number>();
    existingLines.forEach((line, index) => {
      const match = line.match(/^([A-Z_]+)=/);
      if (match) {
        existingKeys.set(match[1], index);
      }
    });

    // Update or add each config key
    for (const key of CONFIG_KEYS) {
      const value = config[key];
      if (value !== undefined && value !== '') {
        const line = `${key}=${value}`;
        if (existingKeys.has(key)) {
          // Update existing line
          existingLines[existingKeys.get(key)!] = line;
        } else {
          // Add new line
          existingLines.push(line);
        }
        // Also update process.env for immediate effect
        process.env[key] = value;
      }
    }

    // Remove empty lines at the end
    while (existingLines.length > 0 && existingLines[existingLines.length - 1].trim() === '') {
      existingLines.pop();
    }

    // Write the updated content
    const newContent = existingLines.join('\n') + '\n';
    writeFileSync(envPath, newContent, 'utf-8');

    log.info({ envPath }, 'Saved provider configuration');

    // Cancel all running agents so new ones use updated config
    const runningCount = agentManager.runningCount;
    if (runningCount > 0) {
      log.info({ count: runningCount }, 'Cancelling running agents to apply new provider config');
      agentManager.cancelAll();
    }

    return NextResponse.json({ success: true, path: envPath, cancelledAgents: runningCount });
  } catch (error) {
    log.error({ err: error }, 'Failed to save provider settings');
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/settings/provider
 * Get current provider status (without exposing the key)
 */
export async function GET() {
  try {
    // Reload config to pick up any external changes (e.g., ~/.claude/settings.json)
    reloadConfigByPriority();

    const appRoot = getAppRoot();
    const appEnvPath = join(appRoot, '.env');
    const claudeDir = join(homedir(), '.claude');
    const userEnvPath = join(claudeDir, '.env');
    const settingsJsonPath = join(claudeDir, 'settings.json');
    const credentialsPath = join(claudeDir, '.credentials.json');
    const claudeJsonPath = join(homedir(), '.claude.json');

    // Check each provider method
    // Method 1: Custom API Key (app .env with ANTHROPIC_AUTH_TOKEN)
    const hasCustomKey = existsSync(appEnvPath) &&
      readFileSync(appEnvPath, 'utf-8').includes('ANTHROPIC_AUTH_TOKEN=');

    // Method 2: Settings.json (ANTHROPIC_AUTH_TOKEN in ~/.claude/settings.json env)
    let hasSettingsJsonKey = false;
    if (existsSync(settingsJsonPath)) {
      try {
        const content = readFileSync(settingsJsonPath, 'utf-8');
        const data = JSON.parse(content);
        // Check if env.ANTHROPIC_AUTH_TOKEN exists
        hasSettingsJsonKey = !!data.env?.ANTHROPIC_AUTH_TOKEN;
      } catch {
        // Ignore parse errors
      }
    }

    // Method 3: Anthropic Console (primaryApiKey in ~/.claude.json)
    let hasConsoleKey = false;
    if (existsSync(claudeJsonPath)) {
      try {
        const content = readFileSync(claudeJsonPath, 'utf-8');
        const data = JSON.parse(content);
        hasConsoleKey = !!data.primaryApiKey;
      } catch {
        // Ignore parse errors
      }
    }

    // Method 4: OAuth (credentials.json exists with claudeAiOauth)
    let hasOAuth = false;
    if (existsSync(credentialsPath)) {
      try {
        const content = readFileSync(credentialsPath, 'utf-8');
        const data = JSON.parse(content);
        hasOAuth = !!data.claudeAiOauth?.accessToken;
      } catch {
        // Ignore parse errors
      }
    }

    // Also check other sources for reference
    const hasUserEnvKey = existsSync(userEnvPath) &&
      (readFileSync(userEnvPath, 'utf-8').includes('ANTHROPIC_AUTH_TOKEN=') ||
       readFileSync(userEnvPath, 'utf-8').includes('ANTHROPIC_API_KEY='));

    // Determine default method based on priority order:
    // 1. ~/.claude/settings.json env.ANTHROPIC_AUTH_TOKEN - highest priority (SDK uses this)
    // 2. App's .env (custom key)
    // 3. ~/.claude.json primaryApiKey -> "console"
    // 4. ~/.claude/.credentials.json OAuth -> "oauth" - lowest priority

    let defaultMethod: 'custom' | 'settings' | 'console' | 'oauth' | null = null;

    if (hasSettingsJsonKey) {
      defaultMethod = 'settings';
    } else if (hasCustomKey) {
      defaultMethod = 'custom';
    } else if (hasConsoleKey) {
      defaultMethod = 'console';
    } else if (hasOAuth) {
      defaultMethod = 'oauth';
    }

    // Get current process.env values (what's actually being used)
    const processEnvConfig: Record<string, string> = {};
    for (const key of CONFIG_KEYS) {
      const value = process.env[key];
      if (value) {
        // Mask sensitive values
        if (key.includes('KEY') || key.includes('TOKEN')) {
          processEnvConfig[key] = value.length > 14 ? value.slice(0, 10) + '...' + value.slice(-4) : '***';
        } else {
          processEnvConfig[key] = value;
        }
      }
    }

    // Get config values from app's .env file directly (for Custom API Key form)
    const appEnvConfig: Record<string, string> = {};
    if (existsSync(appEnvPath)) {
      try {
        const envContent = readFileSync(appEnvPath, 'utf-8');
        const lines = envContent.split('\n');
        for (const line of lines) {
          const match = line.match(/^([A-Z_]+)=(.*)$/);
          if (match && CONFIG_KEYS.includes(match[1])) {
            const key = match[1];
            const value = match[2];
            // Mask sensitive values
            if (key.includes('KEY') || key.includes('TOKEN')) {
              appEnvConfig[key] = value.length > 14 ? value.slice(0, 10) + '...' + value.slice(-4) : '***';
            } else {
              appEnvConfig[key] = value;
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    return NextResponse.json({
      // Provider status
      providers: {
        custom: { configured: hasCustomKey, isDefault: defaultMethod === 'custom' },
        settings: { configured: hasSettingsJsonKey, isDefault: defaultMethod === 'settings' },
        console: { configured: hasConsoleKey, isDefault: defaultMethod === 'console' },
        oauth: { configured: hasOAuth, isDefault: defaultMethod === 'oauth' },
      },
      // Legacy fields for backward compatibility
      hasAppEnvKey: hasCustomKey,
      hasUserEnvKey,
      hasSettingsJsonKey,
      hasOAuthCredentials: hasOAuth,
      hasClaudeJson: hasConsoleKey,
      currentMethod: defaultMethod,
      processEnvConfig,
      appEnvConfig,  // Values from app's .env file for Custom API Key form
      appRoot: getAppRoot(),
    });
  } catch (error) {
    log.error({ err: error }, 'Failed to get provider status');
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/provider
 * Remove API key configuration from project's .env file
 */
export async function DELETE() {
  try {
    const appRoot = getAppRoot();
    const envPath = join(appRoot, '.env');

    if (!existsSync(envPath)) {
      // Still reload from next priority source
      reloadConfigByPriority();
      return NextResponse.json({ success: true, message: 'No .env file exists' });
    }

    const existingContent = readFileSync(envPath, 'utf-8');
    const lines = existingContent.split('\n');

    // Remove all config keys we manage from the file
    const filteredLines = lines.filter(line => {
      const match = line.match(/^([A-Z_]+)=/);
      if (match && CONFIG_KEYS.includes(match[1])) {
        return false;
      }
      return true;
    });

    // Remove trailing empty lines
    while (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].trim() === '') {
      filteredLines.pop();
    }

    // Write the updated content
    const newContent = filteredLines.length > 0 ? filteredLines.join('\n') + '\n' : '';
    writeFileSync(envPath, newContent, 'utf-8');

    log.info({ envPath }, 'Dismissed provider configuration');

    // Reload config from next priority source (settings.json > ~/.claude.json > OAuth)
    reloadConfigByPriority();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, 'Failed to dismiss provider settings');
    return NextResponse.json(
      { error: 'Failed to dismiss settings' },
      { status: 500 }
    );
  }
}
