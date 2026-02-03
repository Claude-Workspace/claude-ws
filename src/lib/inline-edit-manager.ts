/**
 * Inline Edit Manager - Server-side session management for inline code editing
 *
 * Manages in-memory edit sessions, constructs prompts for Claude,
 * and streams responses via Socket.io.
 */

import { EventEmitter } from 'events';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { generateLineDiff, type DiffResult } from './diff-generator';

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
  queryRef?: Query;  // SDK query reference for graceful close()
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

    console.log(`[InlineEditManager] Starting edit session ${sessionId}`);
    console.log(`[InlineEditManager] File: ${filePath}, Language: ${language}`);
    console.log(`[InlineEditManager] Instruction: ${instruction.substring(0, 100)}...`);

    const controller = new AbortController();
    const session: EditSession = {
      sessionId,
      controller,
      buffer: '',
      startedAt: Date.now(),
    };
    this.sessions.set(sessionId, session);

    // Build the prompt
    const prompt = this.buildPrompt(language, selectedCode, instruction, beforeContext, afterContext);

    try {
      const response = query({
        prompt,
        options: {
          cwd: basePath,
          model: 'sonnet', // Use Sonnet for faster responses on inline edits
          permissionMode: 'bypassPermissions' as const,
          ...(maxTurns ? { maxTurns } : {}),
          abortController: controller,
        },
      });

      // Store query reference for graceful close() on cancel
      session.queryRef = response;

      for await (const message of response) {
        if (controller.signal.aborted) {
          console.log(`[InlineEditManager] Session ${sessionId} aborted`);
          break;
        }

        // Handle streaming events (SDK wraps API deltas in stream_event)
        if (message.type === 'stream_event') {
          const streamMsg = message as { type: 'stream_event'; event: { type: string; delta?: { type: string; text?: string } } };
          const event = streamMsg.event;
          if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
            session.buffer += event.delta.text;
            this.emit('delta', { sessionId, chunk: event.delta.text });
          }
        }

        // Handle assistant messages for non-streaming responses
        if (message.type === 'assistant') {
          const assistantMsg = message as { type: 'assistant'; message?: { content: Array<{ type: string; text?: string }> } };
          const content = assistantMsg.message?.content || [];
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              // Only add if we haven't streamed it
              if (!session.buffer.includes(block.text)) {
                session.buffer = block.text;
              }
            }
          }
        }
      }

      if (!controller.signal.aborted) {
        try {
          // Extract code from response
          const generatedCode = this.extractCode(session.buffer);
          const diff = generateLineDiff(selectedCode, generatedCode);

          console.log(`[InlineEditManager] Session ${sessionId} completed`);
          console.log(`[InlineEditManager] Generated ${generatedCode.length} chars, ${diff.addedCount} added, ${diff.removedCount} removed`);

          this.emit('complete', { sessionId, code: generatedCode, diff });
        } catch (processingError) {
          const errorMessage = processingError instanceof Error ? processingError.message : 'Failed to process generated code';
          console.error(`[InlineEditManager] Session ${sessionId} processing error:`, errorMessage);
          this.emit('error', { sessionId, error: errorMessage });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[InlineEditManager] Session ${sessionId} error:`, errorMessage);
      this.emit('error', { sessionId, error: errorMessage });
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Cancel an edit session
   * Uses SDK Query.close() for graceful termination, falls back to AbortController
   */
  cancelEdit(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    console.log(`[InlineEditManager] Cancelling session ${sessionId}`);
    if (session.queryRef) {
      try {
        session.queryRef.close();
      } catch {
        session.controller.abort();
      }
    } else {
      session.controller.abort();
    }
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
   * Build the prompt for Claude
   */
  private buildPrompt(
    language: string,
    selectedCode: string,
    instruction: string,
    beforeContext?: string,
    afterContext?: string
  ): string {
    const langName = language || 'code';

    let contextSection = '';
    if (beforeContext || afterContext) {
      contextSection = `
<surrounding-context>
${beforeContext ? `<before>\n${beforeContext}\n</before>` : ''}
${afterContext ? `<after>\n${afterContext}\n</after>` : ''}
</surrounding-context>
`;
    }

    return `You are a code editor assistant. Your task is to modify the given ${langName} code according to the user's instruction.

IMPORTANT RULES:
1. Output ONLY the modified code - no explanations, no markdown fences, no comments about what you changed
2. Preserve the original indentation style
3. Make minimal changes to accomplish the instruction
4. If the instruction is unclear, make your best interpretation
5. If the code cannot be modified as requested, output the original code unchanged
${contextSection}
<selected-code>
${selectedCode}
</selected-code>

<instruction>
${instruction}
</instruction>

Output the modified code now:`;
  }

  /**
   * Extract code from Claude's response
   * Handles cases where Claude might add markdown fences or explanations
   */
  private extractCode(response: string): string {
    let code = response.trim();

    // Remove markdown code fences if present
    const fenceMatch = code.match(/^```[\w]*\n?([\s\S]*?)```$/);
    if (fenceMatch) {
      code = fenceMatch[1].trim();
    }

    // Remove single backticks if wrapping the whole response
    if (code.startsWith('`') && code.endsWith('`') && !code.includes('\n')) {
      code = code.slice(1, -1);
    }

    return code;
  }

  /**
   * Cleanup stale sessions (older than timeout)
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.startedAt > this.sessionTimeout) {
        console.log(`[InlineEditManager] Cleaning up stale session ${sessionId}`);
        if (session.queryRef) {
          try { session.queryRef.close(); } catch { session.controller.abort(); }
        } else {
          session.controller.abort();
        }
        this.sessions.delete(sessionId);
      }
    }
  }

  // Type-safe event emitter methods
  override on<K extends keyof InlineEditEvents>(event: K, listener: InlineEditEvents[K]): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof InlineEditEvents>(event: K, ...args: Parameters<InlineEditEvents[K]>): boolean {
    console.log(`[InlineEditManager] Emitting ${String(event)}, listeners: ${this.listenerCount(event)}`);
    return super.emit(event, ...args);
  }
}

// Export singleton instance
export const inlineEditManager = new InlineEditManager();
console.log('[InlineEditManager] Singleton created, instance ID:', (inlineEditManager as unknown as { _id?: string })._id = Math.random().toString(36).slice(2));
