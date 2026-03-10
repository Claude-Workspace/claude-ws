/**
 * Helper functions for checkpoint forking operations.
 * Extracts DB copy logic from the fork route to keep route under 200 lines.
 */

import { nanoid } from 'nanoid';
import { db, schema } from '@/lib/db';
import { eq, and, asc, lt } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('CheckpointForkHelpers');

/**
 * Copy attempts (before the checkpoint) from original task to new task.
 * Returns a map of old attempt IDs to new attempt IDs.
 */
export async function copyAttemptsBeforeCheckpoint(
  originalTaskId: string,
  newTaskId: string,
  checkpointAttemptCreatedAt: number
): Promise<Map<string, string>> {
  const originalAttempts = await db.query.attempts.findMany({
    where: and(
      eq(schema.attempts.taskId, originalTaskId),
      lt(schema.attempts.createdAt, checkpointAttemptCreatedAt)
    ),
    orderBy: [asc(schema.attempts.createdAt)],
  });

  const attemptIdMap = new Map<string, string>();

  for (const orig of originalAttempts) {
    const newAttemptId = nanoid();
    attemptIdMap.set(orig.id, newAttemptId);

    await db.insert(schema.attempts).values({
      id: newAttemptId,
      taskId: newTaskId,
      prompt: orig.prompt,
      displayPrompt: orig.displayPrompt,
      status: orig.status,
      sessionId: orig.sessionId,
      branch: orig.branch,
      diffAdditions: orig.diffAdditions,
      diffDeletions: orig.diffDeletions,
      totalTokens: orig.totalTokens,
      inputTokens: orig.inputTokens,
      outputTokens: orig.outputTokens,
      cacheCreationTokens: orig.cacheCreationTokens,
      cacheReadTokens: orig.cacheReadTokens,
      totalCostUSD: orig.totalCostUSD,
      numTurns: orig.numTurns,
      durationMs: orig.durationMs,
      contextUsed: orig.contextUsed,
      contextLimit: orig.contextLimit,
      contextPercentage: orig.contextPercentage,
      baselineContext: orig.baselineContext,
      createdAt: orig.createdAt,
      completedAt: orig.completedAt,
      outputFormat: orig.outputFormat,
      outputSchema: orig.outputSchema,
    });

    // Copy attempt logs
    const logs = await db.query.attemptLogs.findMany({
      where: eq(schema.attemptLogs.attemptId, orig.id),
      orderBy: [asc(schema.attemptLogs.createdAt)],
    });

    for (const logEntry of logs) {
      await db.insert(schema.attemptLogs).values({
        attemptId: newAttemptId,
        type: logEntry.type,
        content: logEntry.content,
        createdAt: logEntry.createdAt,
      });
    }
  }

  log.info({ copiedAttempts: originalAttempts.length, newTaskId }, 'Copied attempts and logs');
  return attemptIdMap;
}

/**
 * Copy checkpoints before the fork point to the new task.
 */
export async function copyCheckpointsBeforeForkPoint(
  originalTaskId: string,
  newTaskId: string,
  forkCheckpointCreatedAt: number,
  attemptIdMap: Map<string, string>
): Promise<number> {
  const originalCheckpoints = await db.query.checkpoints.findMany({
    where: and(
      eq(schema.checkpoints.taskId, originalTaskId),
      lt(schema.checkpoints.createdAt, forkCheckpointCreatedAt)
    ),
    orderBy: [asc(schema.checkpoints.createdAt)],
  });

  for (const origCp of originalCheckpoints) {
    const newAttemptId = attemptIdMap.get(origCp.attemptId);
    if (!newAttemptId) continue;

    await db.insert(schema.checkpoints).values({
      id: nanoid(),
      taskId: newTaskId,
      attemptId: newAttemptId,
      sessionId: origCp.sessionId,
      gitCommitHash: origCp.gitCommitHash,
      messageCount: origCp.messageCount,
      summary: origCp.summary,
      createdAt: origCp.createdAt,
    });
  }

  log.info({ copiedCheckpoints: originalCheckpoints.length, newTaskId }, 'Copied checkpoints');
  return originalCheckpoints.length;
}
