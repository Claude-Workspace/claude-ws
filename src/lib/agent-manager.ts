/**
 * Agent Manager - Provider-agnostic facade for LLM queries
 *
 * Routes queries to appropriate provider adapters and forwards
 * events to Socket.io via EventEmitter interface.
 */

import { EventEmitter } from 'events';
import type { ClaudeOutput } from '@/types';
import {
  getProviderRegistry,
  initializeProviders,
  resolveProviderId,
  toClaudeOutput,
  type NormalizedEvent,
  type LLMProviderAdapter,
  type QueryParams,
} from './providers';
import { sessionManager } from './session-manager';
import { checkpointManager } from './checkpoint-manager';
import { usageTracker } from './usage-tracker';
import { workflowTracker } from './workflow-tracker';
import { collectGitStats, gitStatsCache } from './git-stats-collector';
import type { BackgroundShellInfo } from './sdk-event-adapter';

// Re-export for backward compatibility
export type { BackgroundShellInfo } from './sdk-event-adapter';

export const DEFAULT_MODEL = 'opus' as const;

interface AgentEvents {
  started: (data: { attemptId: string; taskId: string }) => void;
  json: (data: { attemptId: string; data: ClaudeOutput }) => void;
  stderr: (data: { attemptId: string; content: string }) => void;
  exit: (data: { attemptId: string; code: number | null }) => void;
  question: (data: { attemptId: string; toolUseId: string; questions: unknown[] }) => void;
  backgroundShell: (data: { attemptId: string; shell: BackgroundShellInfo }) => void;
  trackedProcess: (data: { attemptId: string; pid: number; command: string; logFile?: string }) => void;
}

export interface AgentStartOptions {
  attemptId: string;
  taskId?: string; // Task ID for session management (e.g., Gemini CLI sessions)
  projectPath: string;
  prompt: string;
  sessionOptions?: {
    resume?: string;
    resumeSessionAt?: string;
  };
  filePaths?: string[];
  outputFormat?: string;
  outputSchema?: string;
  maxTurns?: number;
  providerId?: string; // Provider override (default: from registry)
  modelId?: string; // Model override (uses provider default if not specified)
}

class AgentManager extends EventEmitter {
  private activeQueries = new Map<string, { providerId: string; cancel: () => void }>();

  constructor() {
    super();
    // Initialize provider registry
    initializeProviders();
    // Cleanup on process exit
    process.on('exit', () => this.cancelAll());
  }

  /**
   * Start a new query via provider adapter
   */
  async start(options: AgentStartOptions): Promise<void> {
    const { attemptId, taskId, projectPath, prompt, sessionOptions, filePaths, outputFormat, outputSchema, maxTurns, providerId, modelId } = options;

    if (this.activeQueries.has(attemptId)) {
      console.warn(`[AgentManager] Query ${attemptId} already running`);
      return;
    }

    // Get provider (use specified or default)
    const registry = getProviderRegistry();
    const provider = providerId
      ? registry.get(providerId)
      : registry.getDefault();

    console.log(`[AgentManager] Starting query ${attemptId} with provider: ${provider.id}${modelId ? `, model: ${modelId}` : ''}`);

    // Create abort controller
    const abortController = new AbortController();

    // Track active query
    this.activeQueries.set(attemptId, {
      providerId: provider.id,
      cancel: () => {
        abortController.abort();
        provider.cancel(attemptId);
      },
    });

    // Run query in background
    this.runQuery(provider, {
      attemptId,
      taskId,
      projectPath,
      prompt,
      sessionOptions,
      filePaths,
      outputFormat,
      outputSchema,
      maxTurns,
      modelId,
      abortSignal: abortController.signal,
    });
  }

  private async runQuery(
    provider: LLMProviderAdapter,
    params: QueryParams
  ): Promise<void> {
    const { attemptId, projectPath } = params;

    try {
      for await (const event of provider.query(params)) {
        if (params.abortSignal?.aborted) break;

        // Handle session ID capture
        if (event.sessionId) {
          await sessionManager.saveSession(attemptId, event.sessionId);
        }

        // Handle checkpoint UUID capture
        if (event.checkpointUuid) {
          checkpointManager.captureCheckpointUuid(attemptId, event.checkpointUuid);
        }

        // Handle background shell from provider metadata
        if (event.providerMeta?.backgroundShell) {
          this.emit('backgroundShell', {
            attemptId,
            shell: event.providerMeta.backgroundShell as BackgroundShellInfo,
          });
        }

        // Handle tracked processes (BGPID)
        if (event.providerMeta?.trackedProcess) {
          this.emit('trackedProcess', {
            attemptId,
            ...(event.providerMeta.trackedProcess as { pid: number; command: string; logFile?: string }),
          });
        }

        // Handle question events
        if (event.providerMeta?.question) {
          const question = event.providerMeta.question as { toolUseId: string; questions: unknown[] };
          this.emit('question', {
            attemptId,
            toolUseId: question.toolUseId,
            questions: question.questions,
          });
        }

        // Track usage from result events
        if (event.type === 'result') {
          usageTracker.trackResult(attemptId, event as any);
        }

        // Track workflow events from provider metadata
        if (event.providerMeta?.workflowEvent) {
          const workflow = event.providerMeta.workflowEvent as {
            type: 'subagent_start' | 'subagent_end';
            toolUseId: string;
            subagentType?: string;
            parentToolUseId?: string | null;
            success?: boolean;
          };

          if (workflow.type === 'subagent_start') {
            workflowTracker.trackSubagentStart(
              attemptId,
              workflow.toolUseId,
              workflow.subagentType || 'unknown',
              workflow.parentToolUseId || null
            );
          } else if (workflow.type === 'subagent_end') {
            workflowTracker.trackSubagentEnd(
              attemptId,
              workflow.toolUseId,
              workflow.success ?? true
            );
          }
        }

        // Emit normalized event as ClaudeOutput (backward compatible)
        const output = toClaudeOutput(event);
        this.emit('json', { attemptId, data: output });
      }

      // Collect git stats on completion
      try {
        const gitStats = await collectGitStats(projectPath);
        if (gitStats) {
          gitStatsCache.set(attemptId, gitStats);
        }
      } catch { /* ignore git errors */ }

      this.activeQueries.delete(attemptId);
      this.emit('exit', { attemptId, code: 0 });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('stderr', { attemptId, content: errorMessage });
      this.activeQueries.delete(attemptId);
      this.emit('exit', { attemptId, code: 1 });
    }
  }

  /**
   * Answer a pending question (delegates to provider)
   */
  answerQuestion(attemptId: string, questions: unknown[], answers: Record<string, string>): boolean {
    const query = this.activeQueries.get(attemptId);
    if (!query) return false;

    const provider = getProviderRegistry().get(query.providerId);
    return provider.answerQuestion?.(attemptId, questions, answers) ?? false;
  }

  /**
   * Cancel a pending question (delegates to provider)
   */
  cancelQuestion(attemptId: string): boolean {
    const query = this.activeQueries.get(attemptId);
    if (!query) return false;

    const provider = getProviderRegistry().get(query.providerId);
    return provider.cancelQuestion?.(attemptId) ?? false;
  }

  /**
   * Check if there's a pending question
   */
  hasPendingQuestion(attemptId: string): boolean {
    const query = this.activeQueries.get(attemptId);
    if (!query) return false;

    const provider = getProviderRegistry().get(query.providerId);
    return provider.hasPendingQuestion?.(attemptId) ?? false;
  }

  /**
   * Cancel a running query
   */
  cancel(attemptId: string): boolean {
    const query = this.activeQueries.get(attemptId);
    if (!query) return false;

    query.cancel();
    this.activeQueries.delete(attemptId);
    return true;
  }

  /**
   * Cancel all running queries
   */
  cancelAll(): void {
    for (const [attemptId, query] of this.activeQueries) {
      query.cancel();
    }
    this.activeQueries.clear();
  }

  /**
   * Check if a query is running
   */
  isRunning(attemptId: string): boolean {
    return this.activeQueries.has(attemptId);
  }

  /**
   * Get running query count
   */
  get runningCount(): number {
    return this.activeQueries.size;
  }

  /**
   * Get all running attempt IDs
   */
  getRunningAttempts(): string[] {
    return Array.from(this.activeQueries.keys());
  }

  /**
   * Get session ID for a running query
   */
  getSessionId(attemptId: string): string | undefined {
    const query = this.activeQueries.get(attemptId);
    if (!query) return undefined;

    const provider = getProviderRegistry().get(query.providerId);
    return provider.getSessionId(attemptId);
  }

  // Type-safe event emitter methods
  override on<K extends keyof AgentEvents>(event: K, listener: AgentEvents[K]): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof AgentEvents>(event: K, ...args: Parameters<AgentEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}

// Singleton export
const globalKey = '__claude_agent_manager__' as const;

declare global {
  var __claude_agent_manager__: AgentManager | undefined;
}

export const agentManager: AgentManager =
  (globalThis as any)[globalKey] ?? new AgentManager();

if (!(globalThis as any)[globalKey]) {
  (globalThis as any)[globalKey] = agentManager;
}
