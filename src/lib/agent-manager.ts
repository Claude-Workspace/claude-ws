/**
 * Agent Manager - Thin orchestrator delegating to providers
 *
 * Selects between Claude CLI and SDK providers, builds prompts,
 * and forwards provider events to AgentManager events (identical API).
 * Cross-cutting concerns: sessionManager, checkpointManager, usageTracker, workflowTracker.
 */

// Ensure file checkpointing is always enabled
process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';

// Enable SDK task system (opt-in feature since v0.2.19)
process.env.CLAUDE_CODE_ENABLE_TASKS = 'true';

import { EventEmitter } from 'events';
import type { ClaudeOutput } from '../types';
import type { BackgroundShellInfo } from '@/lib/sdk-event-adapter';
import { getSystemPrompt } from '@/lib/system-prompt';
import { modelIdToDisplayName } from '@/lib/models';
import { createLogger } from '@/lib/logger';
import { getActiveProvider, type Provider, type ProviderSession } from '@/lib/providers';
import { buildOutputFormatPrompt } from '@/lib/agent-output-handler';
import { wireProviderEvents, type EventWiringContext } from '@/lib/agent-event-wiring';
import { PersistentQuestionStore, type PersistentQuestionData } from '@/lib/agent-persistent-question-store';

const log = createLogger('AgentManager');

interface AgentInstance {
  attemptId: string;
  session: ProviderSession;
  provider: Provider;
  startedAt: number;
  outputFormat?: string;
}

interface AgentEvents {
  started: (data: { attemptId: string; taskId: string }) => void;
  json: (data: { attemptId: string; data: ClaudeOutput }) => void;
  stderr: (data: { attemptId: string; content: string }) => void;
  exit: (data: { attemptId: string; code: number | null }) => void;
  question: (data: { attemptId: string; toolUseId: string; questions: unknown[] }) => void;
  questionResolved: (data: { attemptId: string }) => void;
  backgroundShell: (data: { attemptId: string; shell: BackgroundShellInfo }) => void;
  trackedProcess: (data: { attemptId: string; pid: number; command: string; logFile?: string }) => void;
  promptTooLong: (data: { attemptId: string }) => void;
}

export interface AgentStartOptions {
  attemptId: string;
  projectPath: string;
  prompt: string;
  model?: string;
  sessionOptions?: {
    resume?: string;
    resumeSessionAt?: string;
  };
  filePaths?: string[];
  outputFormat?: string;
  outputSchema?: string;
  maxTurns?: number;
}

/**
 * AgentManager - Singleton orchestrator that delegates to providers
 */
class AgentManager extends EventEmitter {
  private agents = new Map<string, AgentInstance>();
  // Track Bash tool_use commands to correlate with BGPID results
  private pendingBashCommands = new Map<string, { command: string; attemptId: string }>();
  // Persistent question storage — survives agent cleanup (keyed by taskId)
  private persistentQuestionStore = new PersistentQuestionStore();

  constructor() {
    super();
    process.on('exit', () => this.cancelAll());
  }

  /**
   * Build the EventWiringContext interface for extracted event wiring
   */
  private buildWiringContext(): EventWiringContext {
    return {
      getSessionId: (attemptId: string) => this.agents.get(attemptId)?.session.sessionId,
      setSessionId: (attemptId: string, sessionId: string) => {
        const instance = this.agents.get(attemptId);
        if (instance) instance.session.sessionId = sessionId;
      },
      deleteAgent: (attemptId: string) => this.agents.delete(attemptId),
      emit: (event: string, data: unknown) => this.emit(event as keyof AgentEvents, data as any),
      pendingBashCommands: this.pendingBashCommands,
    };
  }

  /**
   * Start a new agent query via the active provider
   */
  async start(options: AgentStartOptions): Promise<void> {
    const { attemptId, projectPath, prompt, sessionOptions, filePaths, outputFormat, outputSchema, maxTurns, model } = options;

    if (this.agents.has(attemptId)) return;

    // Build full prompt
    let fullPrompt = prompt;

    if (filePaths && filePaths.length > 0) {
      const fileRefs = filePaths.map(fp => `@${fp}`).join(' ');
      fullPrompt = `${fileRefs} ${prompt}`;
    }

    const systemPrompt = getSystemPrompt({ prompt, projectPath });
    if (systemPrompt) {
      fullPrompt += `\n\n${systemPrompt}`;
    }

    if (outputFormat) {
      fullPrompt += buildOutputFormatPrompt(outputFormat, outputSchema, attemptId);
    }

    // Build model identity for system prompt
    const effectiveModel = model || 'claude-opus-4-6';
    const modelDisplayName = modelIdToDisplayName(effectiveModel);
    const modelIdentity = modelDisplayName !== effectiveModel
      ? `You are powered by the model named ${modelDisplayName}. The exact model ID is ${effectiveModel}.`
      : `You are powered by the model ${effectiveModel}.`;

    const provider = getActiveProvider();

    // Wire up provider events for this attempt
    wireProviderEvents(this.buildWiringContext(), provider, attemptId, outputFormat, projectPath);

    try {
      const session = await provider.start({
        attemptId,
        projectPath,
        prompt: fullPrompt,
        model: effectiveModel,
        sessionOptions,
        maxTurns,
        systemPromptAppend: modelIdentity,
        outputFormat,
        outputSchema,
      });

      const instance: AgentInstance = {
        attemptId,
        session,
        provider,
        startedAt: Date.now(),
        outputFormat,
      };

      this.agents.set(attemptId, instance);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error({ attemptId, err: error }, 'Failed to start provider');
      this.emit('stderr', { attemptId, content: errorMessage });
      this.emit('exit', { attemptId, code: 1 });
    }
  }

  // --- Public API (identical to original) ---

  answerQuestion(attemptId: string, toolUseId: string | undefined, questions: unknown[], answers: Record<string, string>): boolean {
    const instance = this.agents.get(attemptId);
    if (!instance) return false;
    return instance.provider.answerQuestion(attemptId, toolUseId, questions, answers);
  }

  cancelQuestion(attemptId: string): boolean {
    const instance = this.agents.get(attemptId);
    if (!instance) return false;
    return instance.provider.cancelQuestion(attemptId);
  }

  hasPendingQuestion(attemptId: string): boolean {
    const instance = this.agents.get(attemptId);
    if (!instance) return false;
    return instance.provider.hasPendingQuestion(attemptId);
  }

  getPendingQuestionData(attemptId: string): { toolUseId: string; questions: unknown[]; timestamp: number } | null {
    const instance = this.agents.get(attemptId);
    if (!instance) return null;
    return instance.provider.getPendingQuestionData(attemptId);
  }

  getAllPendingQuestions(): Array<{ attemptId: string; toolUseId: string; questions: unknown[]; timestamp: number }> {
    const result: Array<{ attemptId: string; toolUseId: string; questions: unknown[]; timestamp: number }> = [];
    for (const [attemptId, instance] of this.agents) {
      const data = instance.provider.getPendingQuestionData(attemptId);
      if (data) result.push({ attemptId, ...data });
    }
    return result;
  }

  // Persistent question methods — question data survives agent cleanup
  setPersistentQuestion(taskId: string, data: PersistentQuestionData): void {
    this.persistentQuestionStore.set(taskId, data);
  }

  getPersistentQuestion(taskId: string): PersistentQuestionData | null {
    return this.persistentQuestionStore.get(taskId);
  }

  clearPersistentQuestion(taskId: string): void {
    this.persistentQuestionStore.clear(taskId);
  }

  async sendInput(attemptId: string, _input: string): Promise<boolean> {
    const instance = this.agents.get(attemptId);
    if (!instance || !instance.session.sessionId) return false;
    return false;
  }

  async compact(options: { attemptId: string; projectPath: string; conversationSummary?: string }): Promise<void> {
    const { attemptId, projectPath, conversationSummary } = options;
    const compactPrompt = conversationSummary
      ? `You are continuing a previous conversation that reached the context limit. Here is a summary of the previous context:\n\n${conversationSummary}\n\nPlease acknowledge this context briefly and let the user know you're ready to continue.`
      : 'A previous conversation reached the context limit. Please let the user know you are ready to continue with a fresh context.';

    await this.start({ attemptId, projectPath, prompt: compactPrompt, maxTurns: 1 });
  }

  cancel(attemptId: string): boolean {
    const instance = this.agents.get(attemptId);
    if (!instance) return false;

    instance.session.cancel();
    this.agents.delete(attemptId);
    return true;
  }

  cancelAll(): void {
    for (const [, instance] of this.agents) {
      instance.session.cancel();
    }
    this.agents.clear();
  }

  isRunning(attemptId: string): boolean {
    return this.agents.has(attemptId);
  }

  get runningCount(): number {
    return this.agents.size;
  }

  getRunningAttempts(): string[] {
    return Array.from(this.agents.keys());
  }

  getSessionId(attemptId: string): string | undefined {
    return this.agents.get(attemptId)?.session.sessionId;
  }

  // Type-safe event emitter methods
  override on<K extends keyof AgentEvents>(event: K, listener: AgentEvents[K]): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof AgentEvents>(event: K, ...args: Parameters<AgentEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}

// Export singleton instance (global for cross-module access)
const globalKey = '__claude_agent_manager__' as const;

declare global {
  var __claude_agent_manager__: AgentManager | undefined;
}

export const agentManager: AgentManager =
  (globalThis as any)[globalKey] ?? new AgentManager();

if (!(globalThis as any)[globalKey]) {
  (globalThis as any)[globalKey] = agentManager;
}
