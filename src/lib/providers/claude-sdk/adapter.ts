/**
 * Claude SDK Provider Adapter
 *
 * Implements LLMProviderAdapter for @anthropic-ai/claude-agent-sdk.
 * Preserves all existing functionality from agent-manager.ts.
 */

import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { BaseProviderAdapter } from '../base-adapter';
import type { ProviderCapabilities, QueryParams, NormalizedEvent, ModelInfo } from '../types';
import { loadMCPConfig, getMCPToolWildcards } from './mcp-loader';
import { createToolInterceptor, type PendingQuestion } from './tool-interceptor';
import { transformSDKMessage, PROVIDER_ID } from './transformer';
import { isValidSDKMessage } from '@/lib/sdk-event-adapter';
import { getSystemPrompt } from '@/lib/system-prompt';
import { sessionManager } from '@/lib/session-manager';
import { checkpointManager } from '@/lib/checkpoint-manager';
import { createCachedModelFetcher } from '../model-cache';

// Enable file checkpointing and task system
process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';
process.env.CLAUDE_CODE_ENABLE_TASKS = 'true';

export const DEFAULT_MODEL = 'opus' as const;

// Fallback models if API fetch fails
const FALLBACK_CLAUDE_MODELS: ModelInfo[] = [
  { id: 'opus', name: 'Claude Opus 4.5', description: 'Most capable model', isDefault: true },
  { id: 'sonnet', name: 'Claude Sonnet 4', description: 'Balanced speed and capability' },
  { id: 'haiku', name: 'Claude Haiku 3.5', description: 'Fast and efficient' },
];

/**
 * Get models from environment variables (highest priority)
 */
function getEnvModels(): ModelInfo[] {
  const envModels: ModelInfo[] = [];

  // Check ANTHROPIC_MODEL (primary override)
  const primaryModel = process.env.ANTHROPIC_MODEL;
  if (primaryModel) {
    envModels.push({
      id: primaryModel,
      name: formatModelName(primaryModel),
      description: 'Primary model (from ANTHROPIC_MODEL)',
      isDefault: true,
    });
  }

  // Check model-specific overrides
  const opusModel = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL;
  if (opusModel && opusModel !== primaryModel) {
    envModels.push({
      id: opusModel,
      name: formatModelName(opusModel),
      description: 'Opus model (from env)',
      isDefault: !primaryModel,
    });
  }

  const sonnetModel = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
  if (sonnetModel && sonnetModel !== primaryModel && sonnetModel !== opusModel) {
    envModels.push({
      id: sonnetModel,
      name: formatModelName(sonnetModel),
      description: 'Sonnet model (from env)',
      isDefault: false,
    });
  }

  const haikuModel = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
  if (haikuModel && haikuModel !== primaryModel && haikuModel !== opusModel && haikuModel !== sonnetModel) {
    envModels.push({
      id: haikuModel,
      name: formatModelName(haikuModel),
      description: 'Haiku model (from env)',
      isDefault: false,
    });
  }

  if (envModels.length > 0) {
    console.log('[ClaudeSDK] Loaded', envModels.length, 'models from env:', envModels.map(m => m.id).join(', '));
  }

  return envModels;
}

/**
 * Fetch Claude models from Anthropic API
 */
async function fetchClaudeModelsFromAPI(): Promise<ModelInfo[]> {
  // First check environment variables (highest priority)
  const envModels = getEnvModels();
  if (envModels.length > 0) {
    // Return env models as primary, skip API fetch
    return envModels;
  }

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.models.list();

    const models: ModelInfo[] = [];
    for (const model of response.data) {
      // Generate display name if not provided
      const displayName = model.display_name || formatModelName(model.id);

      // Determine description based on model type
      let description: string | undefined;
      if (model.id.includes('opus')) {
        description = 'Most capable model';
      } else if (model.id.includes('sonnet')) {
        description = 'Balanced speed and capability';
      } else if (model.id.includes('haiku')) {
        description = 'Fast and efficient';
      } else if (model.id.includes('flash')) {
        description = 'Fast and versatile';
      } else if (model.id.includes('pro')) {
        description = 'Advanced reasoning';
      }

      models.push({
        id: model.id,
        name: displayName,
        description,
        isDefault: model.id.includes('opus') || model.id.includes('sonnet-4-5'),
      });
    }

    // Sort: opus first, then sonnet, then others
    models.sort((a, b) => {
      const order = ['opus', 'sonnet', 'haiku', 'pro', 'flash'];
      const aType = order.findIndex(t => a.id.includes(t));
      const bType = order.findIndex(t => b.id.includes(t));
      if (aType !== -1 && bType !== -1 && aType !== bType) return aType - bType;
      if (aType !== -1 && bType === -1) return -1;
      if (aType === -1 && bType !== -1) return 1;
      return a.id.localeCompare(b.id);
    });

    console.log('[ClaudeSDK] Fetched', models.length, 'models from API:', models.map(m => m.id).join(', '));
    return models.length > 0 ? models : FALLBACK_CLAUDE_MODELS;
  } catch (error) {
    console.warn('[ClaudeSDK] Failed to fetch models from API:', error);
    throw error; // Let the caching layer handle fallback
  }
}

/**
 * Format model ID into display name
 */
function formatModelName(id: string): string {
  return id
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/(\d)/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Create cached model fetcher for Claude SDK
const claudeModelFetcher = createCachedModelFetcher(
  PROVIDER_ID,
  fetchClaudeModelsFromAPI,
  FALLBACK_CLAUDE_MODELS
);

/**
 * Check if Claude SDK models are from cache
 */
export function isClaudeModelsFromCache(): boolean {
  return claudeModelFetcher.isFromCache();
}

/**
 * Claude SDK Adapter
 *
 * Wraps @anthropic-ai/claude-agent-sdk query() to implement LLMProviderAdapter.
 */
export class ClaudeSDKAdapter extends BaseProviderAdapter {
  readonly id = PROVIDER_ID;
  readonly name = 'Claude (SDK)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    sessionResume: true,
    toolCalling: true,
    mcpSupport: true,
    thinkingBlocks: true,
    maxContextTokens: 200000,
  };

  /**
   * Get available Claude models
   * The SDK supports: opus, sonnet, haiku (aliases for latest versions)
   * Env models take highest priority and bypass cache
   * Always includes "auto" option for SDK-default model selection
   */
  async getModels(): Promise<ModelInfo[]> {
    // Check env models first - bypass cache entirely
    const envModels = getEnvModels();
    const apiModels = envModels.length > 0 ? envModels : await claudeModelFetcher.fetchModels();

    // Always add "auto" option at the top for SDK default
    const autoModel: ModelInfo = {
      id: 'auto',
      name: 'Claude - Auto (SDK Default)',
      description: 'Let SDK choose the best model',
      isDefault: true,
    };

    // Mark other models as non-default since auto is now default
    const models = [autoModel, ...apiModels.map(m => ({ ...m, isDefault: false }))];
    return models;
  }

  private pendingQuestions = new Map<string, PendingQuestion>();
  private queryRefs = new Map<string, Query>();

  /**
   * Execute Claude SDK query and yield normalized events
   */
  async *query(params: QueryParams): AsyncIterable<NormalizedEvent> {
    const { attemptId, projectPath, prompt, sessionOptions, filePaths, outputFormat, outputSchema, maxTurns, modelId, abortSignal } = params;

    // Build full prompt with file refs, system prompt, output instructions
    const fullPrompt = this.buildPrompt(params);

    // Create abort controller
    const controller = new AbortController();
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    // Track instance
    const instance = this.createInstance(attemptId);
    instance.abortController = controller;

    try {
      // Load MCP configuration
      const mcpConfig = loadMCPConfig(projectPath);
      const mcpToolWildcards = mcpConfig?.mcpServers
        ? getMCPToolWildcards(mcpConfig.mcpServers)
        : [];

      // Debug: Log MCP config
      if (mcpConfig?.mcpServers) {
        console.log(`[ClaudeSDKAdapter] Passing MCP servers to SDK:`, JSON.stringify(mcpConfig.mcpServers, null, 2));
        console.log(`[ClaudeSDKAdapter] MCP tool wildcards:`, mcpToolWildcards);
      } else {
        console.log(`[ClaudeSDKAdapter] No MCP config found at ${projectPath}/.mcp.json`);
      }

      // Get checkpointing options
      const checkpointOptions = checkpointManager.getCheckpointingOptions();

      // Determine model to use: "auto" or undefined > DEFAULT_MODEL > explicit modelId
      const resolvedModel = (!modelId || modelId === 'auto') ? DEFAULT_MODEL : modelId;
      console.log(`[ClaudeSDKAdapter] Using model: ${resolvedModel}${!modelId ? ' (default)' : modelId === 'auto' ? ' (auto/default)' : ` (from request: ${modelId})`}`);

      // Configure SDK query
      const queryOptions = {
        cwd: projectPath,
        model: resolvedModel,
        permissionMode: 'bypassPermissions' as const,
        settingSources: ['user', 'project'] as ('user' | 'project')[],
        ...(mcpConfig?.mcpServers ? { mcpServers: mcpConfig.mcpServers } : {}),
        allowedTools: [
          'Skill',
          'Task',
          'Read', 'Write', 'Edit', 'NotebookEdit',
          'Bash', 'Grep', 'Glob',
          'WebFetch', 'WebSearch',
          'TodoWrite', 'AskUserQuestion',
          ...mcpToolWildcards,
        ],
        ...(sessionOptions?.resume ? { resume: sessionOptions.resume } : {}),
        ...(sessionOptions?.resumeSessionAt ? { resumeSessionAt: sessionOptions.resumeSessionAt } : {}),
        ...checkpointOptions,
        ...(maxTurns ? { maxTurns } : {}),
        abortController: controller,
        canUseTool: createToolInterceptor(attemptId, this.pendingQuestions, (toolUseId, questions) => {
          // Question event will be handled by AgentManager via metadata
        }),
      };

      const response = query({ prompt: fullPrompt, options: queryOptions });
      this.queryRefs.set(attemptId, response);

      // Stream SDK messages
      for await (const message of response) {
        if (controller.signal.aborted) break;

        try {
          if (!isValidSDKMessage(message)) continue;

          const { event, sessionId, checkpointUuid, backgroundShell } = transformSDKMessage(message);

          // Track session ID
          if (sessionId) {
            this.setSessionId(attemptId, sessionId);
            await sessionManager.saveSession(attemptId, sessionId);
            event.sessionId = sessionId;
          }

          // Track checkpoint UUID
          if (checkpointUuid) {
            checkpointManager.captureCheckpointUuid(attemptId, checkpointUuid);
            event.checkpointUuid = checkpointUuid;
          }

          // Attach background shell info
          if (backgroundShell) {
            event.providerMeta = { ...event.providerMeta, backgroundShell };
          }

          yield event;
        } catch (messageError) {
          // Per-message errors - log but continue streaming
          const errorMsg = messageError instanceof Error ? messageError.message : 'Unknown message error';
          if (!errorMsg.includes('Unexpected end of JSON')) {
            console.warn('[ClaudeSDKAdapter] Message error:', errorMsg);
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ClaudeSDKAdapter] Query error:', errorMsg);
      throw error;
    } finally {
      this.cleanupInstance(attemptId);
      this.queryRefs.delete(attemptId);
    }
  }

  /**
   * Build full prompt with file refs, system prompt, output format
   */
  private buildPrompt(params: QueryParams): string {
    let fullPrompt = params.prompt;

    // Add file references as @ syntax
    if (params.filePaths && params.filePaths.length > 0) {
      const fileRefs = params.filePaths.map(fp => `@${fp}`).join(' ');
      fullPrompt = `${fileRefs} ${fullPrompt}`;
    }

    // Add system prompt (BGPID instructions)
    const systemPrompt = getSystemPrompt({ prompt: params.prompt, projectPath: params.projectPath });
    if (systemPrompt) {
      fullPrompt += `\n\n${systemPrompt}`;
    }

    // Add output format instructions
    if (params.outputFormat) {
      const dataDir = process.env.DATA_DIR || '.';
      const outputFilePath = `${dataDir}/tmp/${params.attemptId}`;
      fullPrompt += this.buildOutputInstructions(params.outputFormat, outputFilePath, params.outputSchema);
    }

    return fullPrompt;
  }

  /**
   * Build output format instructions
   */
  private buildOutputInstructions(format: string, filePath: string, schema?: string): string {
    const examples: Record<string, string> = {
      json: 'Example: Write:\n["Max", "Bella", "Charlie"]\n\nNOT:\n{Max, Bella, Charlie} (unquoted strings - invalid JSON)\nNOT:\n{"file_path":"...", "content":["Max"]} (don\'t wrap in metadata)',
      yaml: 'Example: Write:\n- Max\n- Bella\n- Charlie\n\nNOT:\n["Max", "Bella", "Charlie"] (that\'s JSON, not YAML)',
      html: 'Example: Write:\n<div class="container">\n  <h1>Results</h1>\n</div>\n\nNOT:\n{"html": "<div>..."} (don\'t wrap in metadata)',
    };

    const example = examples[format.toLowerCase()] || `Example: Write the actual ${format.toUpperCase()} content directly, not wrapped in any metadata or JSON object.`;

    let instructions = `\n\n=== REQUIRED OUTPUT ===\nYou MUST write your WORK RESULTS to a ${format.toUpperCase()} file at: ${filePath}.${format}`;
    if (schema) {
      instructions += `\n\nFormat:\n${schema}`;
    }
    instructions += `\n\nCRITICAL INSTRUCTIONS:
1. Use Write tool with PARAMETER 1 (file path) and PARAMETER 2 (your content)
2. DO NOT wrap content in metadata like {"file_path": ..., "content": ...}
3. The file should contain ONLY the actual ${format.toUpperCase()} data
4. MANDATORY: After writing, you MUST use Read tool to verify the file was written correctly
5. If the file content is invalid, fix it and rewrite

${example}

Your task is INCOMPLETE until:
1. File exists with valid content
2. You have Read it back to verify
========================`;

    return instructions;
  }

  /**
   * Override cancel to use SDK Query.close() for graceful termination
   */
  override cancel(attemptId: string): boolean {
    const queryRef = this.queryRefs.get(attemptId);
    if (queryRef) {
      try {
        queryRef.close();
      } catch {
        // Fallback to abort
      }
    }

    // Clean up pending questions
    const pending = this.pendingQuestions.get(attemptId);
    if (pending) {
      pending.resolve(null);
      this.pendingQuestions.delete(attemptId);
    }

    return super.cancel(attemptId);
  }

  /**
   * Override cancelAll to clean up questions
   */
  override cancelAll(): void {
    // Clean up all pending questions
    for (const [, pending] of this.pendingQuestions) {
      pending.resolve(null);
    }
    this.pendingQuestions.clear();

    // Graceful close all queries
    for (const [, queryRef] of this.queryRefs) {
      try {
        queryRef.close();
      } catch {
        // Fallback handled by super.cancelAll()
      }
    }
    this.queryRefs.clear();

    super.cancelAll();
  }

  /**
   * Answer a pending AskUserQuestion
   */
  answerQuestion(attemptId: string, questions: unknown[], answers: Record<string, string>): boolean {
    const pending = this.pendingQuestions.get(attemptId);
    if (!pending) return false;

    pending.resolve({ questions, answers });
    this.pendingQuestions.delete(attemptId);
    return true;
  }

  /**
   * Cancel a pending question
   */
  cancelQuestion(attemptId: string): boolean {
    const pending = this.pendingQuestions.get(attemptId);
    if (!pending) return false;

    pending.resolve(null);
    this.pendingQuestions.delete(attemptId);
    return true;
  }

  /**
   * Check if there's a pending question
   */
  hasPendingQuestion(attemptId: string): boolean {
    return this.pendingQuestions.has(attemptId);
  }
}
