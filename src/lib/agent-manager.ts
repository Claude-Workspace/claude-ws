/**
 * Agent Manager - Claude Agent SDK integration for task execution
 *
 * Replaces ProcessManager with SDK-native implementation.
 * Provides streaming output, file checkpointing, and session management.
 */

import { EventEmitter } from 'events';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ClaudeOutput } from '@/types';
import { adaptSDKMessage, isValidSDKMessage } from './sdk-event-adapter';
import { sessionManager } from './session-manager';
import { checkpointManager } from './checkpoint-manager';
import { getSystemPrompt } from './system-prompt';

interface AgentInstance {
  attemptId: string;
  controller: AbortController;
  startedAt: number;
  sessionId?: string;
}

interface AgentEvents {
  json: (data: { attemptId: string; data: ClaudeOutput }) => void;
  stderr: (data: { attemptId: string; content: string }) => void;
  exit: (data: { attemptId: string; code: number | null }) => void;
  question: (data: { attemptId: string; toolUseId: string; questions: unknown[] }) => void;
}

export interface AgentStartOptions {
  attemptId: string;
  projectPath: string;
  prompt: string;
  sessionOptions?: {
    resume?: string;
    resumeSessionAt?: string;  // Message UUID to resume conversation at
  };
  filePaths?: string[];
}

/**
 * AgentManager - Singleton class to manage Claude Agent SDK queries
 * EventEmitter interface for backward compatibility with Socket.io forwarding
 */
class AgentManager extends EventEmitter {
  private agents = new Map<string, AgentInstance>();

  constructor() {
    super();
    // Cleanup on process exit
    process.on('exit', () => this.cancelAll());
  }

  /**
   * Start a new Claude Agent SDK query
   */
  async start(options: AgentStartOptions): Promise<void> {
    const { attemptId, projectPath, prompt, sessionOptions, filePaths } = options;

    if (this.agents.has(attemptId)) {
      console.warn(`[AgentManager] Agent ${attemptId} already exists`);
      return;
    }

    console.log(`[AgentManager] Starting agent for attempt ${attemptId}`);
    console.log(`[AgentManager] Project path: ${projectPath}`);
    console.log(`[AgentManager] Prompt: ${prompt.substring(0, 100)}...`);
    if (sessionOptions?.resumeSessionAt) {
      console.log(`[AgentManager] Resuming at message: ${sessionOptions.resumeSessionAt}`);
    } else if (sessionOptions?.resume) {
      console.log(`[AgentManager] Resuming session: ${sessionOptions.resume}`);
    }

    // Build prompt with file references and formatting instructions
    const formatInstructions = getSystemPrompt(projectPath);
    let fullPrompt = prompt;

    // Add file references as @ syntax in prompt
    if (filePaths && filePaths.length > 0) {
      const fileRefs = filePaths.map(fp => `@${fp}`).join(' ');
      fullPrompt = `${fileRefs} ${prompt}`;
    }

    fullPrompt += `\n\n<output-format-guidelines>\n${formatInstructions}\n</output-format-guidelines>`;

    // Create abort controller for cancellation
    const controller = new AbortController();

    const instance: AgentInstance = {
      attemptId,
      controller,
      startedAt: Date.now(),
    };

    this.agents.set(attemptId, instance);

    // Get checkpointing options
    const checkpointOptions = checkpointManager.getCheckpointingOptions();

    // Start SDK query in background
    this.runQuery(instance, projectPath, fullPrompt, sessionOptions, checkpointOptions);
  }

  /**
   * Run SDK query and stream results
   */
  private async runQuery(
    instance: AgentInstance,
    projectPath: string,
    prompt: string,
    sessionOptions?: { resume?: string; resumeSessionAt?: string },
    checkpointOptions?: ReturnType<typeof checkpointManager.getCheckpointingOptions>
  ): Promise<void> {
    const { attemptId, controller } = instance;

    try {
      // Configure SDK query options
      // resumeSessionAt: resume conversation at specific message UUID (for rewind)
      const queryOptions = {
        cwd: projectPath,
        model: 'opus', // Default to Claude Opus 4.5
        permissionMode: 'bypassPermissions' as const,
        ...(sessionOptions?.resume ? { resume: sessionOptions.resume } : {}),
        ...(sessionOptions?.resumeSessionAt ? { resumeSessionAt: sessionOptions.resumeSessionAt } : {}),
        ...checkpointOptions,
        abortController: controller,
      };

      const response = query({ prompt, options: queryOptions });

      // Stream SDK messages
      for await (const message of response) {
        if (controller.signal.aborted) {
          console.log(`[AgentManager] Query aborted for ${attemptId}`);
          break;
        }

        // Validate SDK message structure
        if (!isValidSDKMessage(message)) {
          console.error(`[AgentManager] Invalid SDK message:`, message);
          continue;
        }

        // Adapt SDK message to internal format
        const adapted = adaptSDKMessage(message);

        // Handle session ID capture
        if (adapted.sessionId) {
          instance.sessionId = adapted.sessionId;
          await sessionManager.saveSession(attemptId, adapted.sessionId);
          if (controller.signal.aborted) break; // Check after async operation
        }

        // Handle checkpoint UUID capture
        if (adapted.checkpointUuid) {
          checkpointManager.captureCheckpointUuid(attemptId, adapted.checkpointUuid);
        }

        // Handle AskUserQuestion
        if (adapted.askUserQuestion) {
          this.emit('question', {
            attemptId,
            toolUseId: adapted.askUserQuestion.toolUseId,
            questions: adapted.askUserQuestion.questions,
          });
        }

        // Emit adapted message
        this.emit('json', { attemptId, data: adapted.output });
      }

      // Query completed successfully
      console.log(`[AgentManager] Query completed for ${attemptId}`);
      this.agents.delete(attemptId);
      this.emit('exit', { attemptId, code: 0 });
    } catch (error) {
      console.error(`[AgentManager] Query error for ${attemptId}:`, error);

      // Emit error as stderr
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('stderr', { attemptId, content: errorMessage });

      // Determine exit code based on error type
      const code = controller.signal.aborted ? null : 1;

      this.agents.delete(attemptId);
      this.emit('exit', { attemptId, code });
    }
  }

  /**
   * Send input to a running agent (for AskUserQuestion responses)
   * SDK handles this via continuation with new prompt
   */
  async sendInput(attemptId: string, _input: string): Promise<boolean> {
    const instance = this.agents.get(attemptId);
    if (!instance || !instance.sessionId) {
      return false;
    }

    // For SDK, we need to start a new query with resume
    // This will be handled by creating a new attempt in server.ts
    // Return false to signal caller should create continuation attempt
    return false;
  }

  /**
   * Cancel a running agent
   */
  cancel(attemptId: string): boolean {
    const instance = this.agents.get(attemptId);
    if (!instance) return false;

    instance.controller.abort();
    this.agents.delete(attemptId);
    return true;
  }

  /**
   * Cancel all running agents
   */
  cancelAll(): void {
    for (const [attemptId, instance] of this.agents) {
      instance.controller.abort();
      this.agents.delete(attemptId);
    }
  }

  /**
   * Check if an agent is running
   */
  isRunning(attemptId: string): boolean {
    return this.agents.has(attemptId);
  }

  /**
   * Get running agent count
   */
  get runningCount(): number {
    return this.agents.size;
  }

  /**
   * Get all running attempt IDs
   */
  getRunningAttempts(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get session ID for a running agent
   */
  getSessionId(attemptId: string): string | undefined {
    return this.agents.get(attemptId)?.sessionId;
  }

  // Type-safe event emitter methods
  override on<K extends keyof AgentEvents>(
    event: K,
    listener: AgentEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof AgentEvents>(
    event: K,
    ...args: Parameters<AgentEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// Export singleton instance
export const agentManager = new AgentManager();
