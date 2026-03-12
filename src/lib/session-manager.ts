/**
 * Session Manager - Handles Claude session persistence and resumption
 *
 * Responsible for:
 * - Saving session IDs from SDK init messages
 * - Providing resume/fork options for conversation continuation
 * - Managing session lifecycle including forking after rewind
 */

import { db, schema } from '@/lib/db';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';
import {
  getSessionFilePath,
  sessionFileExists,
  validateSessionFile,
  findLastGoodMessageInSession,
} from '@/lib/session-manager-file-operations';
import { getConversationSummary } from '@/lib/session-manager-conversation-summary';

const log = createLogger('SessionManager');

export interface SessionOptions {
  resume?: string;
  resumeSessionAt?: string;  // Message UUID to resume conversation at
}

export class SessionManager {
  /**
   * Save session ID for an attempt.
   * Always saves to DB — file validation happens at resume time via getSessionOptionsWithAutoFix
   * (The SDK reports session IDs before the .jsonl file is fully written, so checking here causes a race condition)
   */
  async saveSession(attemptId: string, sessionId: string): Promise<void> {
    await db
      .update(schema.attempts)
      .set({ sessionId })
      .where(eq(schema.attempts.id, attemptId));
    log.info(`Saved session ${sessionId} for attempt ${attemptId}`);
  }

  /**
   * Get the last session ID for a task (for resume).
   * Returns sessions from completed or cancelled attempts ONLY.
   *
   * NOTE: Failed attempts are excluded because they may have empty/corrupted
   * session files. When an attempt fails during init the session file may be
   * empty or have only queue operations, causing Claude Code to exit with code 1
   * on resume. Retrying after a failure starts a fresh session instead.
   */
  async getLastSessionId(taskId: string): Promise<string | null> {
    const lastResumableAttempt = await db.query.attempts.findFirst({
      where: and(
        eq(schema.attempts.taskId, taskId),
        inArray(schema.attempts.status, ['completed', 'cancelled'])
      ),
      orderBy: [desc(schema.attempts.createdAt)],
    });
    return lastResumableAttempt?.sessionId ?? null;
  }

  /**
   * Get session ID for a specific attempt
   */
  async getSessionId(attemptId: string): Promise<string | null> {
    const attempt = await db.query.attempts.findFirst({
      where: eq(schema.attempts.id, attemptId),
    });
    return attempt?.sessionId ?? null;
  }

  /**
   * Get SDK session options for a task.
   * Returns { resume, resumeSessionAt } if task was rewound to resume at a specific point,
   * otherwise returns { resume } for normal continuation.
   */
  async getSessionOptions(taskId: string): Promise<SessionOptions> {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
    });

    if (task?.rewindSessionId && task?.rewindMessageUuid) {
      log.info(`Resuming at message ${task.rewindMessageUuid} for task ${taskId}`);
      return { resume: task.rewindSessionId, resumeSessionAt: task.rewindMessageUuid };
    }

    const sessionId = await this.getLastSessionId(taskId);
    return sessionId ? { resume: sessionId } : {};
  }

  /**
   * Clear rewind state after it's been used.
   * Called after successful resume to prevent re-rewinding.
   */
  async clearRewindState(taskId: string): Promise<void> {
    await db
      .update(schema.tasks)
      .set({ rewindSessionId: null, rewindMessageUuid: null, updatedAt: Date.now() })
      .where(eq(schema.tasks.id, taskId));
    log.info(`Cleared rewind state for task ${taskId}`);
  }

  /**
   * Check if task has a pending rewind
   */
  async hasPendingRewind(taskId: string): Promise<boolean> {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
    });
    return !!(task?.rewindSessionId && task?.rewindMessageUuid);
  }

  /**
   * Set rewind state for a task.
   * Called when user rewinds to a checkpoint.
   */
  async setRewindState(taskId: string, sessionId: string, messageUuid: string): Promise<void> {
    await db
      .update(schema.tasks)
      .set({ rewindSessionId: sessionId, rewindMessageUuid: messageUuid, updatedAt: Date.now() })
      .where(eq(schema.tasks.id, taskId));
    log.info(`Set rewind state for task ${taskId}: session=${sessionId}, message=${messageUuid}`);
  }

  // File operation delegates
  getSessionFilePath = getSessionFilePath;
  sessionFileExists = sessionFileExists;
  validateSessionFile = validateSessionFile;
  findLastGoodMessageInSession = findLastGoodMessageInSession;

  /**
   * Get SDK session options with automatic corruption detection.
   * Handles missing/empty/corrupted session files and sessions with API errors.
   */
  async getSessionOptionsWithAutoFix(taskId: string): Promise<SessionOptions> {
    const options = await this.getSessionOptions(taskId);

    if (options.resumeSessionAt) return options;

    if (options.resume) {
      const validation = validateSessionFile(options.resume);
      if (!validation.valid) {
        log.warn(`Session file invalid for ${options.resume}: ${validation.reason}, starting fresh`);
        return {};
      }

      const lastGoodMessage = await findLastGoodMessageInSession(options.resume);
      if (lastGoodMessage) {
        log.info(`Auto-fixing corrupted session ${options.resume}, rewinding to ${lastGoodMessage}`);
        return { resume: options.resume, resumeSessionAt: lastGoodMessage };
      }
    }

    return options;
  }

  /**
   * Extract a conversation summary from a task's attempt logs.
   * Used by compact to carry context into a fresh session.
   */
  getConversationSummary = getConversationSummary;
}

// Singleton instance
export const sessionManager = new SessionManager();
