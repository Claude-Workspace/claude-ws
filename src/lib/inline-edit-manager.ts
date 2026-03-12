/**
 * Inline Edit Manager - Server-side session management for inline code editing
 *
 * Manages in-memory edit sessions, constructs prompts for Claude,
 * and streams responses via Socket.io.
 * Uses CLI query utility for one-shot prompt→response.
 */

import { EventEmitter } from 'events';
import { cliQuery } from './cli-query';
import { generateLineDiff, type DiffResult } from './diff-generator';
import { createLogger } from './logger';
import { buildInlineEditPrompt, extractCodeFromResponse } from './inline-edit-prompt-builder';

const log = createLogger('InlineEditManager');

/**
 * Edit request parameters
 */
export interface InlineEditRequest {
  sessionId: string;
  basePath: string;
  filePath: string;
  language: string;
  selectedCode: string;
  instruction: string;
  beforeContext?: string; // Lines before selection for context
  afterContext?: string; // Lines after selection for context
  maxTurns?: number;  // Max conversation turns (undefined = unlimited)
}

/**
 * Edit session state
 */
interface EditSession {
  sessionId: string;
  controller: AbortController;
  buffer: string;
  startedAt: number;
}

/**
 * Events emitted by InlineEditManager
 */
interface InlineEditEvents {
  delta: (data: { sessionId: string; chunk: string }) => void;
  complete: (data: { sessionId: string; code: string; diff: DiffResult }) => void;
  error: (data: { sessionId: string; error: string }) => void;
}

/**
 * InlineEditManager - Manages in-memory edit sessions
 */
class InlineEditManager extends EventEmitter {
  private sessions = new Map<string, EditSession>();
  private sessionTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super();
    // Cleanup stale sessions periodically
    setInterval(() => this.cleanupStaleSessions(), 60 * 1000);
  }

  /**
   * Start an inline edit session
   */
  async startEdit(request: InlineEditRequest): Promise<void> {
    const { sessionId, basePath, filePath, language, selectedCode, instruction, beforeContext, afterContext, maxTurns } =
      request;

    // Cancel existing session if any
    if (this.sessions.has(sessionId)) {
      this.cancelEdit(sessionId);
    }

    log.debug({ sessionId, filePath, language, instruction: instruction.substring(0, 100) }, 'Starting edit session');

    const controller = new AbortController();
    const session: EditSession = {
      sessionId,
      controller,
      buffer: '',
      startedAt: Date.now(),
    };
    this.sessions.set(sessionId, session);

    // Build the prompt
    const prompt = buildInlineEditPrompt(language, selectedCode, instruction, beforeContext, afterContext);

    try {
      const result = await cliQuery({
        prompt,
        cwd: basePath,
        model: 'claude-sonnet-4-5-20250929', // Use Sonnet for faster inline edits
        signal: controller.signal,
        maxTurns,
        onDelta: (text) => {
          session.buffer += text;
          this.emit('delta', { sessionId, chunk: text });
        },
      });

      if (!controller.signal.aborted) {
        // Use streamed buffer or fall back to final result
        const responseText = session.buffer || result.text;

        try {
          const generatedCode = extractCodeFromResponse(responseText);
          const diff = generateLineDiff(selectedCode, generatedCode);

          log.debug({ sessionId }, 'Session completed');
          log.debug({ charCount: generatedCode.length, addedCount: diff.addedCount, removedCount: diff.removedCount }, 'Code generated');

          this.emit('complete', { sessionId, code: generatedCode, diff });
        } catch (processingError) {
          const errorMessage = processingError instanceof Error ? processingError.message : 'Failed to process generated code';
          log.error({ sessionId, err: processingError, message: errorMessage }, 'Session processing error');
          this.emit('error', { sessionId, error: errorMessage });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error({ sessionId, err: error, message: errorMessage }, 'Session error');
      this.emit('error', { sessionId, error: errorMessage });
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Cancel an edit session
   */
  cancelEdit(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    log.debug({ sessionId }, 'Cancelling session');
    session.controller.abort();
    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Check if a session is active
   */
  isActive(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get active session count
   */
  get activeCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup stale sessions (older than timeout)
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.startedAt > this.sessionTimeout) {
        log.debug({ sessionId }, 'Cleaning up stale session');
        session.controller.abort();
        this.sessions.delete(sessionId);
      }
    }
  }

  // Type-safe event emitter methods
  override on<K extends keyof InlineEditEvents>(event: K, listener: InlineEditEvents[K]): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof InlineEditEvents>(event: K, ...args: Parameters<InlineEditEvents[K]>): boolean {
    log.trace({ event: String(event), listenerCount: this.listenerCount(event) }, 'Emitting event');
    return super.emit(event, ...args);
  }
}

// Export singleton instance
export const inlineEditManager = new InlineEditManager();
log.debug({ instanceId: (inlineEditManager as unknown as { _id?: string })._id = Math.random().toString(36).slice(2) }, 'Singleton created');
