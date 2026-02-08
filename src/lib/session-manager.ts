/**
 * Session Manager - Handles Claude session persistence and resumption
 *
 * Responsible for:
 * - Saving session IDs from SDK init messages
 * - Providing resume/fork options for conversation continuation
 * - Managing session lifecycle including forking after rewind
 */

import { db, schema } from './db';
import { eq, desc, and, inArray } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

import { createLogger } from './logger';

const log = createLogger('SessionManager');

export interface SessionOptions {
  resume?: string;
  resumeSessionAt?: string;  // Message UUID to resume conversation at
}

export class SessionManager {
  /**
   * Save session ID for an attempt
   * Only saves if session file exists and has valid content (prevents corrupt references)
   */
  async saveSession(attemptId: string, sessionId: string): Promise<void> {
    // Validate session file before saving to DB
    // This prevents saving references to empty/corrupted session files
    const validation = this.validateSessionFile(sessionId);
    if (!validation.valid) {
      log.warn(`Skipping session save for ${sessionId}: ${validation.reason}`);
      return;
    }

    await db
      .update(schema.attempts)
      .set({ sessionId })
      .where(eq(schema.attempts.id, attemptId));
    log.info(`Saved session ${sessionId} for attempt ${attemptId}`);
  }

  /**
   * Get the last session ID for a task (for resume)
   * Returns sessions from completed or cancelled attempts ONLY
   *
   * NOTE: Failed attempts are excluded because they may have empty/corrupted
   * session files that cannot be resumed. When an attempt fails during init
   * (e.g., API error, invalid model), the session file may be empty or have
   * only queue operations, causing Claude Code to exit with code 1 on resume.
   *
   * This means retrying after a failure starts a fresh session, but this is
   * safer than cascading resume failures. Users can manually continue from
   * the last successful checkpoint if needed.
   */
  async getLastSessionId(taskId: string): Promise<string | null> {
    const lastResumableAttempt = await db.query.attempts.findFirst({
      where: and(
        eq(schema.attempts.taskId, taskId),
        // Only resume from completed or cancelled - NOT failed
        // Failed attempts may have empty/corrupted session files
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
      log.info(`Resuming at message ${task.rewindMessageUuid} for task ${taskId}`);
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
    log.info(`Cleared rewind state for task ${taskId}`);
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
    log.info(`Set rewind state for task ${taskId}: session=${sessionId}, message=${messageUuid}`);
  }

  /**
   * Get the file path for a session ID
   * Returns null if file doesn't exist
   */
  getSessionFilePath(sessionId: string): string | null {
    const claudeDir = path.join(os.homedir(), '.claude');
    const projectsDir = path.join(claudeDir, 'projects');

    if (!fs.existsSync(projectsDir)) {
      return null;
    }

    const projectDirs = fs.readdirSync(projectsDir);
    for (const projectDir of projectDirs) {
      const candidatePath = path.join(projectsDir, projectDir, `${sessionId}.jsonl`);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
    return null;
  }

  /**
   * Check if a session file exists
   */
  sessionFileExists(sessionId: string): boolean {
    return this.getSessionFilePath(sessionId) !== null;
  }

  /**
   * Validate session file - exists and has content
   * Returns { valid: true } or { valid: false, reason: string }
   */
  validateSessionFile(sessionId: string): { valid: boolean; reason?: string } {
    const filePath = this.getSessionFilePath(sessionId);

    if (!filePath) {
      return { valid: false, reason: 'file_not_found' };
    }

    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return { valid: false, reason: 'file_empty' };
      }

      // Check if file has at least one valid JSONL entry
      const content = fs.readFileSync(filePath, 'utf-8');
      const firstLine = content.split('\n').find(line => line.trim());
      if (!firstLine) {
        return { valid: false, reason: 'no_valid_entries' };
      }

      try {
        JSON.parse(firstLine);
        return { valid: true };
      } catch {
        return { valid: false, reason: 'invalid_json' };
      }
    } catch (err) {
      return { valid: false, reason: 'read_error' };
    }
  }

  /**
   * Check if a session file has API errors at the end and find the last good message
   * Returns the UUID of the last successful assistant message, or null if session is clean
   */
  async findLastGoodMessageInSession(sessionId: string): Promise<string | null> {
    const sessionFilePath = this.getSessionFilePath(sessionId);

    if (!sessionFilePath) {
      log.debug(`Session file not found for ${sessionId}`);
      return null;
    }

    // Read the file and check for API errors
    const lines: string[] = [];
    const fileStream = fs.createReadStream(sessionFilePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (line.trim()) {
        lines.push(line);
      }
    }

    // Check if session ends with API error
    let hasApiErrorAtEnd = false;
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.isApiErrorMessage) {
          hasApiErrorAtEnd = true;
          break;
        }
      } catch {
        log.error(`Failed to parse session line ${i} for session ${sessionId}: ${lines[i]}`);
        const lastLines = lines.slice(-20);
        log.error(`Last ${lastLines.length} lines of session ${sessionId}:\n${lastLines.join('\n')}`);
      }
    }

    if (!hasApiErrorAtEnd) {
      return null; // Session is clean
    }

    log.info(`Session ${sessionId} has API errors at end, finding last good message`);

    // Find the last successful assistant message (not an API error)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'assistant' && !entry.isApiErrorMessage && entry.uuid) {
          log.info(`Found last good message: ${entry.uuid}`);
          return entry.uuid;
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return null;
  }

  /**
   * Get SDK session options for a task with automatic corruption detection
   * Handles:
   * - Missing session files (don't resume)
   * - Empty/corrupted session files (don't resume)
   * - Sessions with API errors at end (rewind to last good message)
   */
  async getSessionOptionsWithAutoFix(taskId: string): Promise<SessionOptions> {
    const options = await this.getSessionOptions(taskId);

    // If already using rewind, no need to check
    if (options.resumeSessionAt) {
      return options;
    }

    // If we have a session to resume, validate it
    if (options.resume) {
      // Validate session file exists and has content
      const validation = this.validateSessionFile(options.resume);
      if (!validation.valid) {
        log.warn(`Session file invalid for ${options.resume}: ${validation.reason}, starting fresh`);
        return {}; // Don't resume - start fresh
      }

      // Check if session has API errors at end
      const lastGoodMessage = await this.findLastGoodMessageInSession(options.resume);
      if (lastGoodMessage) {
        log.info(`Auto-fixing corrupted session ${options.resume}, rewinding to ${lastGoodMessage}`);
        return {
          resume: options.resume,
          resumeSessionAt: lastGoodMessage,
        };
      }
    }

    return options;
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
