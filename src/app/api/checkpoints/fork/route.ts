import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { nanoid } from 'nanoid';
import { db, schema } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { checkpointManager } from '@/lib/checkpoint-manager';
import { sessionManager } from '@/lib/session-manager';
import { copyAttemptsBeforeCheckpoint, copyCheckpointsBeforeForkPoint } from '@/lib/checkpoint-fork-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('CheckpointForkAPI');

// Ensure file checkpointing is enabled (in case API route runs in separate process)
process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';

// POST /api/checkpoints/fork
// Body: { checkpointId: string }
// Creates a NEW task that forks conversation from a checkpoint.
// The original task and its attempts/checkpoints are left untouched.
// Rewinds files using SDK rewindFiles() when checkpoint UUID exists.
// Returns the new task for the UI to navigate to.
export async function POST(request: Request) {
  try {
    const { checkpointId } = await request.json();

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

    // Get original task
    const originalTask = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, checkpoint.taskId),
    });
    if (!originalTask) {
      return NextResponse.json({ error: 'Original task not found' }, { status: 404 });
    }

    // Get the attempt prompt for pre-filling input after fork
    const attempt = await db.query.attempts.findFirst({
      where: eq(schema.attempts.id, checkpoint.attemptId),
    });

    // Attempt SDK file rewind if checkpoint UUID exists
    let sdkRewindResult: { success: boolean; error?: string } | null = null;
    if (checkpoint.gitCommitHash && checkpoint.sessionId) {
      sdkRewindResult = await attemptSdkFileRewind(checkpoint, originalTask.projectId);
    }

    // All DB writes wrapped in a transaction for data integrity
    const { newTask, newTaskId } = await db.transaction(async () => {
      // Determine position in todo column
      const tasksInTodo = await db
        .select()
        .from(schema.tasks)
        .where(and(
          eq(schema.tasks.projectId, originalTask.projectId),
          eq(schema.tasks.status, 'todo')
        ))
        .orderBy(desc(schema.tasks.position))
        .limit(1);

      const position = tasksInTodo.length > 0 ? tasksInTodo[0].position + 1 : 0;
      const id = nanoid();
      const truncatedTitle = originalTask.title.length > 74
        ? originalTask.title.slice(0, 74) + '...'
        : originalTask.title;

      const task = {
        id,
        projectId: originalTask.projectId,
        title: `Fork: ${truncatedTitle}`,
        description: originalTask.description,
        status: 'todo' as const,
        position,
        chatInit: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.insert(schema.tasks).values(task);
      log.info({ newTaskId: id, originalTaskId: originalTask.id, checkpointId }, 'Created forked task');

      // Get checkpoint attempt timestamp for copy boundary
      const checkpointAttempt = await db.query.attempts.findFirst({
        where: eq(schema.attempts.id, checkpoint.attemptId),
      });
      const cutoffTime = checkpointAttempt?.createdAt ?? checkpoint.createdAt;

      // Copy attempts and their logs before the checkpoint
      const attemptIdMap = await copyAttemptsBeforeCheckpoint(originalTask.id, id, cutoffTime);

      // Copy checkpoints before the fork point
      await copyCheckpointsBeforeForkPoint(originalTask.id, id, checkpoint.createdAt, attemptIdMap);

      // Set rewind state so the new task's first attempt resumes from the checkpoint
      if (checkpoint.gitCommitHash) {
        await sessionManager.setRewindState(id, checkpoint.sessionId, checkpoint.gitCommitHash);
      }

      return { newTask: task, newTaskId: id };
    });

    return NextResponse.json({
      success: true,
      task: newTask,
      taskId: newTaskId,
      originalTaskId: originalTask.id,
      sessionId: checkpoint.sessionId,
      messageUuid: checkpoint.gitCommitHash,
      attemptId: checkpoint.attemptId,
      attemptPrompt: attempt?.prompt || null,
      sdkRewind: sdkRewindResult,
      conversationForked: !!checkpoint.gitCommitHash,
    });
  } catch (error) {
    log.error({ err: error }, 'Failed to fork from checkpoint');
    return NextResponse.json({ error: 'Failed to fork from checkpoint' }, { status: 500 });
  }
}

/**
 * Attempt to rewind files using SDK checkpointing.
 * Returns result object; does not throw on failure.
 */
async function attemptSdkFileRewind(
  checkpoint: { sessionId: string; gitCommitHash: string | null },
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) return { success: false, error: 'Project not found' };

  try {
    log.info({ projectPath: project.path, sessionId: checkpoint.sessionId, messageUuid: checkpoint.gitCommitHash }, 'Attempting SDK file rewind for fork');

    const checkpointOptions = checkpointManager.getCheckpointingOptions();
    const rewindQuery = query({
      prompt: '',
      options: {
        cwd: project.path,
        resume: checkpoint.sessionId,
        ...checkpointOptions,
      },
    });

    await rewindQuery.supportedCommands();

    const rewindResult = await rewindQuery.rewindFiles(checkpoint.gitCommitHash!);
    if (!rewindResult.canRewind) {
      const baseError = rewindResult.error || 'Cannot rewind files';
      throw new Error(
        baseError.includes('No file checkpoint')
          ? `${baseError}. SDK only tracks files within project directory (${project.path}).`
          : baseError
      );
    }

    log.info({ filesChanged: rewindResult.filesChanged?.length || 0 }, 'SDK file rewind for fork successful');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error({ err: error }, 'SDK rewind for fork failed');
    return { success: false, error: errorMessage };
  }
}
