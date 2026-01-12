import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { db, schema } from '@/lib/db';
import { eq, and, gt } from 'drizzle-orm';
import { checkpointManager } from '@/lib/checkpoint-manager';
import { sessionManager } from '@/lib/session-manager';

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

    let sdkRewindResult: { success: boolean; error?: string } | null = null;

    // Rewind files using SDK if requested and checkpoint UUID exists
    // Note: gitCommitHash field now stores SDK checkpoint UUID
    if (rewindFiles && checkpoint.gitCommitHash && checkpoint.sessionId && task) {
      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, task.projectId),
      });

      if (project) {
        try {
          // Get checkpointing options
          const checkpointOptions = checkpointManager.getCheckpointingOptions();

          // Resume the session with empty prompt to rewind files
          const rewindQuery = query({
            prompt: '', // Empty prompt to open connection
            options: {
              cwd: project.path,
              resume: checkpoint.sessionId,
              ...checkpointOptions,
            },
          });

          // Call rewindFiles with checkpoint UUID
          // We need to iterate to open the connection first
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const _msg of rewindQuery) {
            await rewindQuery.rewindFiles(checkpoint.gitCommitHash);
            break;
          }

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

    // Get all attempts after this checkpoint for the same task
    const laterAttempts = await db.query.attempts.findMany({
      where: and(
        eq(schema.attempts.taskId, checkpoint.taskId),
        gt(schema.attempts.createdAt, checkpoint.createdAt)
      ),
    });

    // Delete later attempts (cascades to logs and checkpoints)
    for (const attempt of laterAttempts) {
      await db.delete(schema.attempts).where(eq(schema.attempts.id, attempt.id));
    }

    // Delete checkpoints after this one (same task)
    await db.delete(schema.checkpoints).where(
      and(
        eq(schema.checkpoints.taskId, checkpoint.taskId),
        gt(schema.checkpoints.createdAt, checkpoint.createdAt)
      )
    );

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
