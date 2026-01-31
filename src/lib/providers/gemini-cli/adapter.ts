/**
 * Gemini CLI Adapter
 *
 * LLM provider adapter for Google's Gemini CLI (@google/gemini-cli).
 * Uses child process spawning with NDJSON streaming.
 */

import { BaseProviderAdapter } from '../base-adapter';
import type { ProviderCapabilities, QueryParams, NormalizedEvent, ModelInfo } from '../types';
import { spawnGeminiProcess, isGeminiInstalled } from './process-manager';
import { parseGeminiLine, transformGeminiEvent, PROVIDER_ID } from './transformer';
import { getSessionUuid, saveSessionUuid } from './session-manager';
import { fetchGeminiModels } from './model-fetcher';

export class GeminiCLIAdapter extends BaseProviderAdapter {
  readonly id = PROVIDER_ID;
  readonly name = 'Gemini (CLI)';
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    sessionResume: true, // Uses --resume <uuid> flag with session manager
    toolCalling: true,
    mcpSupport: true,
    thinkingBlocks: false, // Gemini doesn't have thinking blocks
    maxContextTokens: 2000000, // 2M tokens
  };

  private processes = new Map<string, { kill: () => void }>();

  /**
   * Get available Gemini models from API
   * Uses OAuth credentials from ~/.gemini/oauth_creds.json
   */
  async getModels(): Promise<ModelInfo[]> {
    return fetchGeminiModels();
  }

  /**
   * Check if Gemini CLI is available
   */
  static isAvailable(): boolean {
    return isGeminiInstalled();
  }

  /**
   * Execute query and stream normalized events
   */
  async *query(params: QueryParams): AsyncIterable<NormalizedEvent> {
    const { attemptId, taskId, projectPath, prompt, modelId, abortSignal } = params;

    // Look up existing session UUID for this task
    let sessionUuid: string | null = null;
    if (taskId) {
      sessionUuid = await getSessionUuid(taskId, projectPath);
    }

    // Determine model to use: explicit modelId > default
    const resolvedModel = modelId || 'gemini-2.5-flash';
    console.log('[GeminiCLI] Starting query:', {
      attemptId,
      taskId,
      projectPath,
      model: resolvedModel,
      prompt: prompt.substring(0, 100),
      sessionUuid,
    });

    if (!isGeminiInstalled()) {
      console.error('[GeminiCLI] Gemini CLI not installed');
      yield {
        type: 'result',
        provider: PROVIDER_ID,
        subtype: 'error',
        is_error: true,
        providerMeta: { error: 'Gemini CLI not installed. Run: npm install -g @google/gemini-cli' },
      } as NormalizedEvent;
      return;
    }

    const controller = new AbortController();
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    this.instances.set(attemptId, { abortController: controller, startedAt: Date.now() });

    try {
      console.log('[GeminiCLI] Spawning process...');
      const { process: proc, lines } = await spawnGeminiProcess({
        cwd: projectPath,
        prompt,
        model: resolvedModel,
        contextPaths: params.filePaths,
        abortSignal: controller.signal,
        sessionUuid: sessionUuid ?? undefined,
      });

      console.log('[GeminiCLI] Process spawned, PID:', proc.pid);
      this.processes.set(attemptId, { kill: () => proc.kill('SIGTERM') });

      // Handle stderr
      proc.stderr?.on('data', (data: Buffer) => {
        console.warn('[GeminiCLI] stderr:', data.toString());
      });

      // Handle exit
      proc.on('exit', (code) => {
        console.log('[GeminiCLI] Process exited with code:', code);
        if (code !== 0 && code !== null) {
          console.error('[GeminiCLI] Process exited with non-zero code:', code);
        }
      });

      // Process NDJSON lines
      let lineCount = 0;
      for await (const line of lines) {
        if (controller.signal.aborted) break;

        const trimmed = line.trim();
        if (!trimmed) continue;

        lineCount++;

        const event = parseGeminiLine(trimmed);
        if (!event) {
          console.log('[GeminiCLI] Failed to parse line');
          continue;
        }

        // Capture session_id from init event and save to DB
        if (event.type === 'init' && 'session_id' in event && event.session_id && taskId) {
          console.log('[GeminiCLI] Session for task', taskId, ':', event.session_id);
          await saveSessionUuid(taskId, projectPath, event.session_id);

          // Update instance with session ID
          const instance = this.instances.get(attemptId);
          if (instance) instance.sessionId = event.session_id;
        }

        const normalized = transformGeminiEvent(event);
        if (!normalized) {
          console.log('[GeminiCLI] Failed to transform event:', event.type);
          continue;
        }

        // Capture session ID from normalized event (backward compat)
        const sessionId = (normalized as any).session_id || normalized.sessionId;
        if (sessionId) {
          const instance = this.instances.get(attemptId);
          if (instance) instance.sessionId = sessionId;
        }

        yield normalized;
      }

      // Emit completion if process exited normally
      yield {
        type: 'result',
        provider: PROVIDER_ID,
        subtype: 'success',
      } as NormalizedEvent;
    } catch (error) {
      console.error('[GeminiCLI] Error:', error);
      yield {
        type: 'result',
        provider: PROVIDER_ID,
        subtype: 'error',
        is_error: true,
        providerMeta: { error: error instanceof Error ? error.message : 'Unknown error' },
      } as NormalizedEvent;
    } finally {
      this.instances.delete(attemptId);
      this.processes.delete(attemptId);
    }
  }

  /**
   * Cancel a running query
   */
  override cancel(attemptId: string): boolean {
    const proc = this.processes.get(attemptId);
    if (proc) {
      proc.kill();
      this.processes.delete(attemptId);
    }
    return super.cancel(attemptId);
  }
}
