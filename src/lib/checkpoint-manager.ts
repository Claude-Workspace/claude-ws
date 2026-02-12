/**
 * Checkpoint Manager - Handles SDK-based file checkpointing
 *
 * Uses Claude Agent SDK's built-in file checkpointing instead of git snapshots.
 * Captures user message UUIDs as restore points for rewindFiles().
 */

import type { Query } from '@anthropic-ai/claude-agent-sdk';
import { db, schema } from './db';
import { eq, and, gt, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { createLogger } from './logger';

const log = createLogger('CheckpointManager');

export interface CheckpointData {
  id: string;
  attemptId: string;
  sessionId: string;
  taskId: string;
  userMessageUuid: string; // SDK checkpoint UUID from user message
  messageCount: number;
  summary?: string;
  createdAt: number;
}

/**
 * In-memory storage for checkpoint data during active attempts
 * Maps attemptId -> { uuid, queryRef }
 *
 * IMPORTANT: File checkpoints are created BEFORE file modifications occur.
 * The FIRST user message UUID is the restore point for rewinding files,
 * because that's when the SDK captures the pre-modification file state.
 */
interface ActiveCheckpoint {
  uuid: string;
  queryRef?: Query;
}
const activeCheckpoints = new Map<string, ActiveCheckpoint>();

export class CheckpointManager {
  /**
   * Capture a checkpoint UUID from a user message
   * Called when SDK emits user message with uuid
   *
   * IMPORTANT: Only captures the FIRST UUID per attempt.
   * File checkpoints are created before file modifications, so the
   * first user message UUID is the correct restore point.
   */
  captureCheckpointUuid(attemptId: string, uuid: string): void {
    // Only capture the FIRST UUID - don't overwrite with subsequent ones
    if (!activeCheckpoints.has(attemptId)) {
      activeCheckpoints.set(attemptId, { uuid });
      log.info({ attemptId, uuid }, 'Captured FIRST checkpoint UUID');
    } else {
      log.info({ attemptId, uuid, keeping: activeCheckpoints.get(attemptId)?.uuid }, 'Skipping subsequent UUID (keeping first)');
    }
  }

  /**
   * Get the latest checkpoint UUID for an attempt
   */
  getCheckpointUuid(attemptId: string): string | null {
    return activeCheckpoints.get(attemptId)?.uuid ?? null;
  }

  /**
   * Set the SDK query reference for an attempt (used for rewindFiles on error)
   */
  setQueryRef(attemptId: string, queryRef: Query): void {
    const existing = activeCheckpoints.get(attemptId);
    if (existing) {
      existing.queryRef = queryRef;
    }
  }

  /**
   * Clear checkpoint tracking for an attempt (on completion/cancellation)
   * Also reverts changed files using SDK rewindFiles if a checkpoint UUID was captured
   */
  async clearAttemptCheckpoint(attemptId: string): Promise<void> {
    const checkpoint = activeCheckpoints.get(attemptId);
    if (!checkpoint) return;

    // Revert changed files if we have both UUID and query ref
    if (checkpoint.uuid && checkpoint.queryRef) {
      try {
        log.info({ attemptId, checkpointUuid: checkpoint.uuid }, 'Reverting files on checkpoint clear');
        const rewindResult = await checkpoint.queryRef.rewindFiles(checkpoint.uuid);
        if (rewindResult.canRewind) {
          log.info({ attemptId, filesChanged: rewindResult.filesChanged?.length || 0 }, 'Files reverted successfully');
        } else {
          log.warn({ attemptId, error: rewindResult.error }, 'Could not revert files');
        }
      } catch (rewindError) {
        log.error({ err: rewindError, attemptId }, 'Failed to revert files');
      }
    }

    activeCheckpoints.delete(attemptId);
  }

  /**
   * Save checkpoint to database on successful attempt completion
   */
  async saveCheckpoint(
    attemptId: string,
    taskId: string,
    sessionId: string,
    messageCount: number,
    summary?: string
  ): Promise<string | null> {
    const checkpoint = activeCheckpoints.get(attemptId);
    const checkpointUuid = checkpoint?.uuid;

    if (!checkpointUuid) {
      log.info({ attemptId }, 'No checkpoint UUID, skipping save');
      return null;
    }

    const checkpointId = nanoid();

    await db.insert(schema.checkpoints).values({
      id: checkpointId,
      taskId,
      attemptId,
      sessionId,
      // Store SDK checkpoint UUID in gitCommitHash field (reusing existing schema)
      // This field now serves as "file checkpoint ID" rather than git hash
      gitCommitHash: checkpointUuid,
      messageCount,
      summary,
    });

    log.info({ checkpointId, checkpointUuid }, 'Saved checkpoint');

    // Cleanup in-memory tracking (skip rewindFiles since this is a successful save)
    activeCheckpoints.delete(attemptId);

    return checkpointId;
  }

  /**
   * Get checkpoint by ID
   */
  async getCheckpoint(checkpointId: string) {
    return db.query.checkpoints.findFirst({
      where: eq(schema.checkpoints.id, checkpointId),
    });
  }

  /**
   * Get checkpoints for a task
   */
  async getTaskCheckpoints(taskId: string) {
    return db.query.checkpoints.findMany({
      where: eq(schema.checkpoints.taskId, taskId),
      orderBy: [desc(schema.checkpoints.createdAt)],
    });
  }

  /**
   * Delete checkpoints after a specific checkpoint (for rewind)
   */
  async deleteCheckpointsAfter(taskId: string, afterTimestamp: number): Promise<void> {
    await db.delete(schema.checkpoints).where(
      and(
        eq(schema.checkpoints.taskId, taskId),
        gt(schema.checkpoints.createdAt, afterTimestamp)
      )
    );
  }

  /**
   * Get SDK options for file checkpointing
   * Must be spread into query() options
   */
  getCheckpointingOptions(): {
    enableFileCheckpointing: boolean;
    extraArgs: Record<string, null>;
  } {
    // Note: CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING is set globally in server.ts
    return {
      enableFileCheckpointing: true,
      extraArgs: { 'replay-user-messages': null }, // Required to get UUIDs
    };
  }
}

// Singleton instance
export const checkpointManager = new CheckpointManager();
