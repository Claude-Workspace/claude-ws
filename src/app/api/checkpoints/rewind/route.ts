import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { db, schema } from '@/lib/db';
import { eq, and, gt, gte } from 'drizzle-orm';
import { checkpointManager } from '@/lib/checkpoint-manager';
import { sessionManager } from '@/lib/session-manager';

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
          console.log(`[Rewind] Attempting SDK file rewind for project: ${project.path}`);
          console.log(`[Rewind] Session: ${checkpoint.sessionId}, Message UUID: ${checkpoint.gitCommitHash}`);

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
          console.log(`[Rewind] Available checkpoints:`, checkpointsList || 'listCheckpoints not available');

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

          console.log(`[Rewind] Files changed: ${rewindResult.filesChanged?.length || 0}, +${rewindResult.insertions || 0} -${rewindResult.deletions || 0}`);

          sdkRewindResult = { success: true };
          console.log(`[Rewind] SDK rewind successful for checkpoint ${checkpointId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[Rewind] SDK rewind failed:', errorMessage);
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

    console.log(`[Rewind] Found ${attemptIdsToDelete.size} attempts to delete (checkpoint's attempt + later ones)`);

    // Delete attempts and their logs
    for (const attemptId of attemptIdsToDelete) {
      console.log(`[Rewind] Deleting attempt ${attemptId} and its logs`);
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

    console.log(`[Rewind] Deleted ${deletedCheckpoints.length} checkpoints (this one + later ones)`);

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
    console.error('Failed to rewind checkpoint:', error);
    return NextResponse.json(
      { error: 'Failed to rewind checkpoint' },
      { status: 500 }
    );
  }
}
