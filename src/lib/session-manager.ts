/**
 * Session Manager - Handles Claude session persistence and resumption
 *
 * Responsible for:
 * - Saving session IDs from SDK init messages
 * - Providing resume/fork options for conversation continuation
 * - Managing session lifecycle including forking after rewind
 */

import { db, schema } from './db';
import { eq, desc, and } from 'drizzle-orm';

export interface SessionOptions {
  resume?: string;
  resumeSessionAt?: string;  // Message UUID to resume conversation at
}

export class SessionManager {
  /**
   * Save session ID for an attempt
   */
  async saveSession(attemptId: string, sessionId: string): Promise<void> {
    await db
      .update(schema.attempts)
      .set({ sessionId })
      .where(eq(schema.attempts.id, attemptId));
    console.log(`[SessionManager] Saved session ${sessionId} for attempt ${attemptId}`);
  }

  /**
   * Get the last session ID for a task (for resume)
   * Only returns sessions from SUCCESSFUL attempts - failed attempts may have corrupted sessions
   */
  async getLastSessionId(taskId: string): Promise<string | null> {
    const lastSuccessfulAttempt = await db.query.attempts.findFirst({
      where: and(
        eq(schema.attempts.taskId, taskId),
        eq(schema.attempts.status, 'completed')
      ),
      orderBy: [desc(schema.attempts.createdAt)],
    });
    return lastSuccessfulAttempt?.sessionId ?? null;
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
   * Get SDK session options for a task
   * Returns { resume, resumeSessionAt } if task was rewound to resume at specific point
   * Otherwise returns { resume } for normal continuation
   */
  async getSessionOptions(taskId: string): Promise<SessionOptions> {
    // Check if task has rewind state (after rewind)
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
    });

    if (task?.rewindSessionId && task?.rewindMessageUuid) {
      console.log(`[SessionManager] Resuming at message ${task.rewindMessageUuid} for task ${taskId}`);
      return {
        resume: task.rewindSessionId,
        resumeSessionAt: task.rewindMessageUuid,
      };
    }

    // Otherwise use normal resume from last successful attempt
    const sessionId = await this.getLastSessionId(taskId);
    return sessionId ? { resume: sessionId } : {};
  }

  /**
   * Clear rewind state after it's been used
   * Called after successful resume to prevent re-rewinding
   */
  async clearRewindState(taskId: string): Promise<void> {
    await db
      .update(schema.tasks)
      .set({ rewindSessionId: null, rewindMessageUuid: null, updatedAt: Date.now() })
      .where(eq(schema.tasks.id, taskId));
    console.log(`[SessionManager] Cleared rewind state for task ${taskId}`);
  }

  /**
   * Check if task has pending rewind
   */
  async hasPendingRewind(taskId: string): Promise<boolean> {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
    });
    return !!(task?.rewindSessionId && task?.rewindMessageUuid);
  }

  /**
   * Set rewind state for a task
   * Called when user rewinds to a checkpoint
   */
  async setRewindState(taskId: string, sessionId: string, messageUuid: string): Promise<void> {
    await db
      .update(schema.tasks)
      .set({
        rewindSessionId: sessionId,
        rewindMessageUuid: messageUuid,
        updatedAt: Date.now(),
      })
      .where(eq(schema.tasks.id, taskId));
    console.log(`[SessionManager] Set rewind state for task ${taskId}: session=${sessionId}, message=${messageUuid}`);
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
