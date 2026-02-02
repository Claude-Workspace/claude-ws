import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { db, schema } from '@/lib/db';
import { eq, and, gt, gte } from 'drizzle-orm';
import { checkpointManager } from '@/lib/checkpoint-manager';
import { sessionManager } from '@/lib/session-manager';
import { createLogger } from '@/lib/logger';

const log = createLogger('CheckpointRewindAPI');

// Ensure file checkpointing is enabled (in case API route runs in separate process)
process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';

// POST /api/checkpoints/rewind
// Body: { checkpointId: string, rewindFiles?: boolean }
// Deletes all attempts/logs/checkpoints after this checkpoint
// Optionally rewinds files using SDK rewindFiles()
// Returns the checkpoint's sessionId for resuming
export async function POST(request: Request) {
  try {
    const { checkpointId, rewindFiles = true } = await request.json();

    if (!checkpointId) {
      return NextResponse.json({ error: 'checkpointId required' }, { status: 400 });
    }

    // Get the checkpoint
    const checkpoint = await db.query.checkpoints.findFirst({
      where: eq(schema.checkpoints.id, checkpointId),
    });

    if (!checkpoint) {
      return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 });
    }

    // Get task and project for SDK rewind
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, checkpoint.taskId),
    });

    // Get the attempt to retrieve its prompt for pre-filling input after rewind
    const attempt = await db.query.attempts.findFirst({
      where: eq(schema.attempts.id, checkpoint.attemptId),
    });

    let sdkRewindResult: { success: boolean; error?: string } | null = null;

    // Rewind files using SDK if requested and checkpoint UUID exists
    // Note: gitCommitHash field now stores SDK checkpoint UUID
    if (rewindFiles && checkpoint.gitCommitHash && checkpoint.sessionId && task) {
      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, task.projectId),
      });

      if (project) {
        try {
          log.info({ projectPath: project.path, sessionId: checkpoint.sessionId, messageUuid: checkpoint.gitCommitHash }, 'Attempting SDK file rewind');

          // Get checkpointing options
          const checkpointOptions = checkpointManager.getCheckpointingOptions();

          // Resume the session WITHOUT resumeSessionAt - let rewindFiles handle positioning
          // resumeSessionAt can interfere with file checkpoint access
          const rewindQuery = query({
            prompt: '', // Empty prompt - just need to open session for rewind
            options: {
              cwd: project.path,
              resume: checkpoint.sessionId, // Only resume session, don't position
              ...checkpointOptions,
            },
          });

          // Wait for SDK initialization before calling rewindFiles
          // supportedCommands() awaits the initialization promise internally
          await rewindQuery.supportedCommands();

          // List available checkpoints first for debugging
          // Note: listCheckpoints may not exist in all SDK versions
          const checkpointsList = await (rewindQuery as any).listCheckpoints?.();
          log.debug({ checkpointsList: checkpointsList || 'listCheckpoints not available' }, 'Available checkpoints');

          // Call rewindFiles with the message UUID
          const rewindResult = await rewindQuery.rewindFiles(checkpoint.gitCommitHash);

          if (!rewindResult.canRewind) {
            // Provide more context about why rewind might fail
            const baseError = rewindResult.error || 'Cannot rewind files';
            const contextualError = baseError.includes('No file checkpoint')
              ? `${baseError}. Note: SDK only tracks files within the project directory (${project.path}). Files created at absolute paths outside this directory are not tracked.`
              : baseError;
            throw new Error(contextualError);
          }

          log.info({ filesChanged: rewindResult.filesChanged?.length || 0, insertions: rewindResult.insertions || 0, deletions: rewindResult.deletions || 0 }, 'Files changed');

          sdkRewindResult = { success: true };
          log.info({ checkpointId }, 'SDK rewind successful');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          log.error({ err: error }, 'SDK rewind failed');
          sdkRewindResult = { success: false, error: errorMessage };
          // Continue with conversation rewind even if SDK rewind fails
        }
      }
    }

    // Get the checkpoint's own attempt + all attempts after this checkpoint
    // When rewinding to a checkpoint, we DELETE that attempt so user can re-run it
    // This is the expected UX: "rewind to X" means go back BEFORE X happened
    const laterAttempts = await db.query.attempts.findMany({
      where: and(
        eq(schema.attempts.taskId, checkpoint.taskId),
        gte(schema.attempts.createdAt, checkpoint.createdAt)
      ),
    });

    // Also ensure we include the checkpoint's own attempt (in case timing differs)
    const attemptIdsToDelete = new Set(laterAttempts.map(a => a.id));
    attemptIdsToDelete.add(checkpoint.attemptId);

    log.info({ count: attemptIdsToDelete.size }, 'Found attempts to delete (checkpoint attempt + later ones)');

    // Delete attempts and their logs
    for (const attemptId of attemptIdsToDelete) {
      log.debug({ attemptId }, 'Deleting attempt and its logs');
      // Explicitly delete logs first (in case CASCADE doesn't work)
      await db.delete(schema.attemptLogs).where(eq(schema.attemptLogs.attemptId, attemptId));
      // Delete attempt files
      await db.delete(schema.attemptFiles).where(eq(schema.attemptFiles.attemptId, attemptId));
      // Delete the attempt
      await db.delete(schema.attempts).where(eq(schema.attempts.id, attemptId));
    }

    // Delete this checkpoint and all after it (same task)
    const deletedCheckpoints = await db.delete(schema.checkpoints).where(
      and(
        eq(schema.checkpoints.taskId, checkpoint.taskId),
        gte(schema.checkpoints.createdAt, checkpoint.createdAt)
      )
    ).returning();

    log.info({ count: deletedCheckpoints.length }, 'Deleted checkpoints (this one + later ones)');

    // Set rewind state on task so next attempt resumes at this checkpoint's message
    // This ensures conversation context is rewound to checkpoint point
    // gitCommitHash stores the user message UUID for conversation rewind
    if (checkpoint.gitCommitHash) {
      await sessionManager.setRewindState(
        checkpoint.taskId,
        checkpoint.sessionId,
        checkpoint.gitCommitHash
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: checkpoint.sessionId,
      messageUuid: checkpoint.gitCommitHash,
      taskId: checkpoint.taskId,
      attemptId: checkpoint.attemptId,
      attemptPrompt: attempt?.prompt || null, // Include prompt for pre-filling input
      sdkRewind: sdkRewindResult,
      conversationRewound: !!checkpoint.gitCommitHash,
    });
  } catch (error) {
    log.error({ err: error }, 'Failed to rewind checkpoint');
    return NextResponse.json(
      { error: 'Failed to rewind checkpoint' },
      { status: 500 }
    );
  }
}
