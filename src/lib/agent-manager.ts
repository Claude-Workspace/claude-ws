/**
 * Agent Manager - Claude Agent SDK integration for task execution
 *
 * Replaces ProcessManager with SDK-native implementation.
 * Provides streaming output, file checkpointing, and session management.
 */

import { EventEmitter } from 'events';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ClaudeOutput } from '@/types';
import { adaptSDKMessage, isValidSDKMessage, type BackgroundShellInfo, type SDKResultMessage } from './sdk-event-adapter';
import { sessionManager } from './session-manager';
import { checkpointManager } from './checkpoint-manager';
import { getSystemPrompt } from './system-prompt';
import { usageTracker } from './usage-tracker';
import { workflowTracker } from './workflow-tracker';
import { collectGitStats, gitStatsCache } from './git-stats-collector';

// Default model for agent queries
export const DEFAULT_MODEL = 'opus' as const;

interface AgentInstance {
  attemptId: string;
  controller: AbortController;
  startedAt: number;
  sessionId?: string;
}

// Pending question resolver type
interface PendingQuestion {
  toolUseId: string;
  resolve: (answer: QuestionAnswer | null) => void;
}

// Answer format for AskUserQuestion tool
interface QuestionAnswer {
  questions: unknown[];
  answers: Record<string, string>;
}

interface AgentEvents {
  json: (data: { attemptId: string; data: ClaudeOutput }) => void;
  stderr: (data: { attemptId: string; content: string }) => void;
  exit: (data: { attemptId: string; code: number | null }) => void;
  question: (data: { attemptId: string; toolUseId: string; questions: unknown[] }) => void;
  backgroundShell: (data: { attemptId: string; shell: BackgroundShellInfo }) => void;
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
  private pendingQuestions = new Map<string, PendingQuestion>();

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

    // Build prompt with file references and task-aware system prompt
    const isResume = !!(sessionOptions?.resume || sessionOptions?.resumeSessionAt);
    const formatInstructions = getSystemPrompt({
      projectPath,
      prompt,
      isResume,
      attemptCount: 1, // TODO: Pass actual attempt count from caller
    });
    let fullPrompt = prompt;

    // Add file references as @ syntax in prompt
    if (filePaths && filePaths.length > 0) {
      const fileRefs = filePaths.map(fp => `@${fp}`).join(' ');
      fullPrompt = `${fileRefs} ${prompt}`;
    }

    fullPrompt += `\n\n<system-guidelines>\n${formatInstructions}\n</system-guidelines>`;

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
        model: DEFAULT_MODEL, // 'opus' - proxy API will handle mapping
        permissionMode: 'bypassPermissions' as const,
        ...(sessionOptions?.resume ? { resume: sessionOptions.resume } : {}),
        ...(sessionOptions?.resumeSessionAt ? { resumeSessionAt: sessionOptions.resumeSessionAt } : {}),
        ...checkpointOptions,
        abortController: controller,
        // canUseTool callback - pauses streaming when AskUserQuestion is called
        canUseTool: async (toolName: string, input: Record<string, unknown>) => {
          // Handle AskUserQuestion tool - pause and wait for user input
          if (toolName === 'AskUserQuestion') {
            // Prevent duplicate questions for same attempt
            if (this.pendingQuestions.has(attemptId)) {
              console.warn(`[AgentManager] Duplicate question for ${attemptId}, rejecting`);
              return { behavior: 'deny' as const, message: 'Duplicate question' };
            }

            const toolUseId = `ask-${Date.now()}`;
            const questions = (input.questions as unknown[]) || [];

            // Emit question event to frontend (streaming is paused here)
            this.emit('question', { attemptId, toolUseId, questions });

            // Wait for user answer (no timeout - user can take as long as needed)
            const answer = await new Promise<QuestionAnswer | null>((resolve) => {
              this.pendingQuestions.set(attemptId, { toolUseId, resolve });
            });

            // Clean up pending question
            this.pendingQuestions.delete(attemptId);

            // Check if cancellation (null/empty answers)
            if (!answer || Object.keys(answer.answers).length === 0) {
              return { behavior: 'deny' as const, message: 'User cancelled' };
            }

            // Return allow with user's answers (cast to Record<string, unknown> for SDK)
            return {
              behavior: 'allow' as const,
              updatedInput: answer as unknown as Record<string, unknown>,
            };
          }

          // Auto-allow all other tools (bypassPermissions mode)
          return { behavior: 'allow' as const, updatedInput: input };
        },
      };

      const response = query({ prompt, options: queryOptions });

      // Stream SDK messages with per-message error handling
      // The SDK's internal partial-json-parser can throw on incomplete JSON
      for await (const message of response) {
        if (controller.signal.aborted) {
          console.log(`[AgentManager] Query aborted for ${attemptId}`);
          break;
        }

        try {
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

          // Track subagent workflow (from assistant messages with Task tool)
          if (message.type === 'assistant' && 'message' in message) {
            const assistantMsg = message as { message: { content: Array<{ type: string; id?: string; name?: string }> }; parent_tool_use_id: string | null };
            for (const block of assistantMsg.message.content) {
              if (block.type === 'tool_use' && block.name === 'Task' && block.id) {
                const taskInput = (block as { input?: { subagent_type?: string } }).input;
                const subagentType = taskInput?.subagent_type || 'unknown';
                console.log(`[AgentManager] Tracking subagent start: ${subagentType} (${block.id})`);
                workflowTracker.trackSubagentStart(
                  attemptId,
                  block.id,
                  subagentType,
                  assistantMsg.parent_tool_use_id
                );
              }
            }
          }

          // Track subagent completion (from user messages with tool_result)
          if (message.type === 'user' && 'message' in message) {
            const userMsg = message as { message: { content: Array<{ type: string; tool_use_id?: string; is_error?: boolean }> } };
            for (const block of userMsg.message.content) {
              if (block.type === 'tool_result' && block.tool_use_id) {
                const success = !block.is_error;
                workflowTracker.trackSubagentEnd(attemptId, block.tool_use_id, success);
              }
            }
          }

          // Track usage stats from result messages
          if (message.type === 'result') {
            const resultMsg = message as SDKResultMessage;
            console.log(`[AgentManager] Tracking usage for ${attemptId}:`, resultMsg);
            usageTracker.trackResult(attemptId, resultMsg);
          }

          // Note: AskUserQuestion is now handled via canUseTool callback
          // which properly pauses streaming until user responds

          // Handle background shell (Bash with run_in_background=true)
          if (adapted.backgroundShell) {
            this.emit('backgroundShell', {
              attemptId,
              shell: adapted.backgroundShell,
            });
          }

          // Emit adapted message
          this.emit('json', { attemptId, data: adapted.output });
        } catch (messageError) {
          // Handle per-message errors (e.g., SDK's partial-json-parser failures)
          // Log but continue streaming - don't let one bad message kill the stream
          const errorMsg = messageError instanceof Error ? messageError.message : 'Unknown message error';
          console.warn(`[AgentManager] Error processing message for ${attemptId}:`, errorMsg);

          // Only emit if it's a significant error (not just parsing issues)
          if (errorMsg.includes('Unexpected end of JSON')) {
            // This is a common streaming artifact - log but don't spam stderr
            console.debug(`[AgentManager] Partial JSON received, continuing...`);
          } else {
            this.emit('stderr', { attemptId, content: `Warning: ${errorMsg}` });
          }
        }
      }

      // Query completed successfully
      console.log(`[AgentManager] Query completed for ${attemptId}`);

      // Collect git stats snapshot on completion
      try {
        const gitStats = await collectGitStats(projectPath);
        if (gitStats) {
          gitStatsCache.set(attemptId, gitStats);
          console.log(`[AgentManager] Git stats collected: +${gitStats.additions} -${gitStats.deletions}`);
        }
      } catch (gitError) {
        console.warn(`[AgentManager] Failed to collect git stats:`, gitError);
      }

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
   * Answer a pending AskUserQuestion
   * Resolves the waiting canUseTool callback and resumes streaming
   */
  answerQuestion(attemptId: string, questions: unknown[], answers: Record<string, string>): boolean {
    const pending = this.pendingQuestions.get(attemptId);
    if (!pending) {
      console.warn(`[AgentManager] No pending question for ${attemptId}`);
      return false;
    }

    // Resolve the pending Promise - SDK will resume streaming
    pending.resolve({ questions, answers });
    this.pendingQuestions.delete(attemptId);
    console.log(`[AgentManager] Answered question for ${attemptId}`);
    return true;
  }

  /**
   * Cancel a pending AskUserQuestion (user clicked cancel/escape)
   * Returns deny to tell Claude the user declined
   */
  cancelQuestion(attemptId: string): boolean {
    const pending = this.pendingQuestions.get(attemptId);
    if (!pending) {
      return false;
    }

    // Resolve with null to signal cancellation
    // canUseTool callback will return { behavior: 'deny' }
    pending.resolve(null);
    this.pendingQuestions.delete(attemptId);
    console.log(`[AgentManager] Cancelled question for ${attemptId}`);
    return true;
  }

  /**
   * Check if there's a pending question for an attempt
   */
  hasPendingQuestion(attemptId: string): boolean {
    return this.pendingQuestions.has(attemptId);
  }

  /**
   * Send input to a running agent (legacy method)
   * @deprecated Use answerQuestion() for AskUserQuestion responses
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

    // Clean up any pending questions for this attempt
    const pending = this.pendingQuestions.get(attemptId);
    if (pending) {
      pending.resolve(null); // Resolve with null to unblock and signal cancellation
      this.pendingQuestions.delete(attemptId);
    }

    instance.controller.abort();
    this.agents.delete(attemptId);
    return true;
  }

  /**
   * Cancel all running agents
   */
  cancelAll(): void {
    // Clean up all pending questions first
    for (const [attemptId, pending] of this.pendingQuestions) {
      pending.resolve(null);
    }
    this.pendingQuestions.clear();

    // Then abort all agents
    for (const [attemptId, instance] of this.agents) {
      instance.controller.abort();
    }
    this.agents.clear();
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
