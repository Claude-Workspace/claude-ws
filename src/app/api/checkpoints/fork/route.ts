import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { checkpointManager } from '@/lib/checkpoint-manager';
import { sessionManager } from '@/lib/session-manager';
import { createLogger } from '@/lib/logger';

const log = createLogger('CheckpointForkAPI');

// Ensure file checkpointing is enabled (in case API route runs in separate process)
process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';

// POST /api/checkpoints/fork
// Body: { checkpointId: string, rewindFiles?: boolean }
// Forks conversation from a checkpoint WITHOUT deleting any attempts or checkpoints
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

    // Get the attempt to retrieve its prompt for pre-filling input after fork
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
          log.info({ projectPath: project.path, sessionId: checkpoint.sessionId, messageUuid: checkpoint.gitCommitHash }, 'Attempting SDK file rewind for fork');

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
          log.info({ checkpointId }, 'SDK rewind for fork successful');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          log.error({ err: error }, 'SDK rewind for fork failed');
          sdkRewindResult = { success: false, error: errorMessage };
          // Continue with conversation fork even if SDK rewind fails
        }
      }
    }

    // Set rewind state on task so next attempt resumes at this checkpoint's message
    // This ensures conversation context is forked from checkpoint point
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
      conversationForked: !!checkpoint.gitCommitHash,
    });
  } catch (error) {
    log.error({ err: error }, 'Failed to fork from checkpoint');
    return NextResponse.json(
      { error: 'Failed to fork from checkpoint' },
      { status: 500 }
    );
  }
}
