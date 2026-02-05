import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { createLogger } from '@/lib/logger';
import { randomBytes } from 'crypto';

const log = createLogger('ApiAccessKeyAPI');

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

  // 3. Try process.cwd() - works in most cases when run from project root
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'package.json'))) {
    return cwd;
  }

  // 4. Walk up from __dirname to find package.json (development fallback)
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 5. Final fallback to cwd (even without package.json)
  log.warn({ cwd }, 'Could not find package.json, using cwd');
  return cwd;
}

/**
 * Generate a secure random API key
 */
function generateApiKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * GET /api/settings/api-access-key
 * Check if API_ACCESS_KEY is configured
 */
export async function GET() {
  try {
    const appRoot = getAppRoot();
    const envPath = join(appRoot, '.env');

    let hasApiAccessKey = false;
    let maskedKey: string | null = null;

    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const match = line.match(/^API_ACCESS_KEY=(.*)$/);
        if (match && match[1].trim()) {
          hasApiAccessKey = true;
          const key = match[1].trim();
          // Mask the key for display
          if (key.length > 8) {
            maskedKey = key.slice(0, 4) + '••••' + key.slice(-4);
          } else {
            maskedKey = '••••••••';
          }
          break;
        }
      }
    }

    // Also check process.env in case key was set but not in file
    if (!hasApiAccessKey && process.env.API_ACCESS_KEY) {
      hasApiAccessKey = true;
      const key = process.env.API_ACCESS_KEY;
      if (key.length > 8) {
        maskedKey = key.slice(0, 4) + '••••' + key.slice(-4);
      } else {
        maskedKey = '••••••••';
      }
    }

    return NextResponse.json({
      configured: hasApiAccessKey,
      maskedKey,
    });
  } catch (error) {
    log.error({ err: error }, 'Failed to check API access key status');
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/api-access-key
 * Save API_ACCESS_KEY to .env file
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { apiKey } = body;

    // Generate a key if not provided
    if (!apiKey) {
      apiKey = generateApiKey();
    }

    // Validate key format (alphanumeric, minimum 16 characters)
    if (typeof apiKey !== 'string' || apiKey.length < 16) {
      return NextResponse.json(
        { error: 'API key must be at least 16 characters' },
        { status: 400 }
      );
    }

    const appRoot = getAppRoot();
    const envPath = join(appRoot, '.env');

    // Read existing .env content if it exists
    let existingLines: string[] = [];
    if (existsSync(envPath)) {
      const existingContent = readFileSync(envPath, 'utf-8');
      existingLines = existingContent.split('\n');
    }

    // Find and update or add API_ACCESS_KEY
    let keyFound = false;
    for (let i = 0; i < existingLines.length; i++) {
      if (existingLines[i].match(/^API_ACCESS_KEY=/)) {
        existingLines[i] = `API_ACCESS_KEY=${apiKey}`;
        keyFound = true;
        break;
      }
    }

    if (!keyFound) {
      // Add after other config lines or at the end
      existingLines.push(`API_ACCESS_KEY=${apiKey}`);
    }

    // Remove empty lines at the end
    while (existingLines.length > 0 && existingLines[existingLines.length - 1].trim() === '') {
      existingLines.pop();
    }

    // Write the updated content
    const newContent = existingLines.join('\n') + '\n';
    writeFileSync(envPath, newContent, 'utf-8');

    // Update process.env for immediate effect
    process.env.API_ACCESS_KEY = apiKey;

    log.info({ envPath }, 'Saved API access key');

    return NextResponse.json({
      success: true,
      apiKey, // Return the key so user can copy it
      message: 'API access key saved. Server restart required for full effect.',
    });
  } catch (error) {
    log.error({ err: error }, 'Failed to save API access key');
    return NextResponse.json(
      { error: 'Failed to save API access key' },
      { status: 500 }
    );
  }
}
