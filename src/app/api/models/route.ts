import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  modelIdToDisplayName,
  Model,
} from '@/lib/models';

const SELECTED_MODEL_KEY = 'selectedModel';

/**
 * Get the app root directory (where .env is located)
 */
function getAppRoot(): string {
  // 1. Explicit environment variable
  if (process.env.APP_ROOT && existsSync(process.env.APP_ROOT)) {
    return process.env.APP_ROOT;
  }

  // 2. Common Docker app directory
  if (existsSync('/app/package.json')) {
    return '/app';
  }

  // 3. Try process.cwd()
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'package.json'))) {
    return cwd;
  }

  // 4. Walk up from __dirname
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return cwd;
}

/**
 * Read env values directly from app's .env file
 */
function getEnvFromFile(): Record<string, string> {
  const envPath = join(getAppRoot(), '.env');
  const result: Record<string, string> = {};

  if (!existsSync(envPath)) {
    return result;
  }

  try {
    const content = readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) {
        result[match[1]] = match[2];
      }
    }
  } catch {
    // Ignore errors
  }

  return result;
}

/**
 * Build model list based on priority:
 * 1. ENV file - use all defined models from .env file
 * 2. Fallback to predefined AVAILABLE_MODELS
 */
function buildModelList(): Model[] {
  const envFile = getEnvFromFile();
  const envModels: Model[] = [];

  // Check all env model vars from .env file
  const envVars = [
    { key: 'ANTHROPIC_MODEL', value: envFile.ANTHROPIC_MODEL },
    { key: 'ANTHROPIC_DEFAULT_OPUS_MODEL', value: envFile.ANTHROPIC_DEFAULT_OPUS_MODEL },
    { key: 'ANTHROPIC_DEFAULT_SONNET_MODEL', value: envFile.ANTHROPIC_DEFAULT_SONNET_MODEL },
    { key: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', value: envFile.ANTHROPIC_DEFAULT_HAIKU_MODEL },
  ];

  for (const { value } of envVars) {
    if (value && !envModels.some((m) => m.id === value)) {
      const tier = value.toLowerCase().includes('opus')
        ? 'opus'
        : value.toLowerCase().includes('haiku')
          ? 'haiku'
          : 'sonnet';

      envModels.push({
        id: value,
        name: modelIdToDisplayName(value),
        tier,
      });
    }
  }

  // If any env models defined, use them; otherwise fallback to predefined
  return envModels.length > 0 ? envModels : AVAILABLE_MODELS;
}

/**
 * Get current model based on priority:
 * 1. ENV file (ANTHROPIC_MODEL, ANTHROPIC_DEFAULT_*_MODEL)
 * 2. Cached selection from app_settings
 * 3. Default fallback
 */
function getCurrentModel(): { modelId: string; source: 'env' | 'cached' | 'default' } {
  const envFile = getEnvFromFile();

  // Priority 1: Check ENV file - accept ANY model ID from env
  const envModel = envFile.ANTHROPIC_MODEL;
  if (envModel) {
    return { modelId: envModel, source: 'env' };
  }

  // Check tier-specific env vars from file
  const tierEnvVars = {
    opus: envFile.ANTHROPIC_DEFAULT_OPUS_MODEL,
    sonnet: envFile.ANTHROPIC_DEFAULT_SONNET_MODEL,
    haiku: envFile.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  };

  for (const [, value] of Object.entries(tierEnvVars)) {
    if (value) {
      return { modelId: value, source: 'env' };
    }
  }

  // Priority 2 & 3: Will be handled in GET handler (async db lookup)
  return { modelId: DEFAULT_MODEL_ID, source: 'default' };
}

// GET /api/models - List available models and current selection
export async function GET() {
  try {
    const models = buildModelList();
    let currentModelId = DEFAULT_MODEL_ID;
    let source: 'env' | 'cached' | 'default' = 'default';

    // Check ENV first (sync)
    const envResult = getCurrentModel();
    if (envResult.source === 'env') {
      currentModelId = envResult.modelId;
      source = 'env';
    } else {
      // Check cached from db
      const cached = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, SELECTED_MODEL_KEY))
        .limit(1);

      if (cached.length > 0 && cached[0].value) {
        currentModelId = cached[0].value;
        source = 'cached';
      }
    }

    return NextResponse.json({
      models,
      current: currentModelId,
      source,
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}

// POST /api/models - Set current model
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model } = body;

    if (!model || typeof model !== 'string') {
      return NextResponse.json({ error: 'model is required' }, { status: 400 });
    }

    // Save to app_settings (upsert) - accept any model ID
    await db
      .insert(appSettings)
      .values({ key: SELECTED_MODEL_KEY, value: model, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: model, updatedAt: Date.now() },
      });

    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error('Error saving model:', error);
    return NextResponse.json({ error: 'Failed to save model' }, { status: 500 });
  }
}
