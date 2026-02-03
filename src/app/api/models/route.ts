import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  modelIdToDisplayName,
  Model,
} from '@/lib/models';

const SELECTED_MODEL_KEY = 'selectedModel';

/**
 * Build model list from process.env or fallback to SDK defaults
 */
function buildModelList(): Model[] {
  const hasCustomAuth = !!process.env.ANTHROPIC_AUTH_TOKEN;

  if (hasCustomAuth) {
    const envModels: Model[] = [];
    const envVars = [
      process.env.ANTHROPIC_MODEL,
      process.env.ANTHROPIC_DEFAULT_OPUS_MODEL,
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
      process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    ];

    for (const value of envVars) {
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

    if (envModels.length > 0) {
      return envModels;
    }
  }

  return AVAILABLE_MODELS;
}

/**
 * Get current model from process.env or default
 */
function getCurrentModel(): { modelId: string; source: 'env' | 'cached' | 'default' } {
  const hasCustomAuth = !!process.env.ANTHROPIC_AUTH_TOKEN;

  if (hasCustomAuth) {
    const envModel = process.env.ANTHROPIC_MODEL;
    if (envModel) {
      return { modelId: envModel, source: 'env' };
    }

    // Check tier-specific env vars
    const tierVars = [
      process.env.ANTHROPIC_DEFAULT_OPUS_MODEL,
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
      process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    ];

    for (const value of tierVars) {
      if (value) {
        return { modelId: value, source: 'env' };
      }
    }
  }

  // Will be handled in GET handler (async db lookup)
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
