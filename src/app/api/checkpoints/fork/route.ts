import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { nanoid } from 'nanoid';
import { db, schema } from '@/lib/db';
import { eq, and, desc, asc, lt } from 'drizzle-orm';
import { checkpointManager } from '@/lib/checkpoint-manager';
import { sessionManager } from '@/lib/session-manager';
import { createLogger } from '@/lib/logger';

const log = createLogger('CheckpointForkAPI');

// Ensure file checkpointing is enabled (in case API route runs in separate process)
process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';

// POST /api/checkpoints/fork
// Body: { checkpointId: string, rewindFiles?: boolean }
// Creates a NEW task that forks conversation from a checkpoint
// The original task and its attempts/checkpoints are left untouched
// Optionally rewinds files using SDK rewindFiles()
// Returns the new task for the UI to navigate to
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

    // Get original task
    const originalTask = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, checkpoint.taskId),
    });

    if (!originalTask) {
      return NextResponse.json({ error: 'Original task not found' }, { status: 404 });
    }

    // Get the attempt to retrieve its prompt for pre-filling input after fork
    const attempt = await db.query.attempts.findFirst({
      where: eq(schema.attempts.id, checkpoint.attemptId),
    });

    let sdkRewindResult: { success: boolean; error?: string } | null = null;

    // Rewind files using SDK if requested and checkpoint UUID exists
    // Note: gitCommitHash field now stores SDK checkpoint UUID
    if (rewindFiles && checkpoint.gitCommitHash && checkpoint.sessionId) {
      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, originalTask.projectId),
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
          // Continue with fork even if SDK rewind fails
        }
      }
    }

    // Create a new task in the same project
    const tasksInTodo = await db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.projectId, originalTask.projectId),
          eq(schema.tasks.status, 'todo')
        )
      )
      .orderBy(desc(schema.tasks.position))
      .limit(1);

    const position = tasksInTodo.length > 0 ? tasksInTodo[0].position + 1 : 0;

    const newTaskId = nanoid();
    const truncatedTitle = originalTask.title.length > 80
      ? originalTask.title.slice(0, 80) + '...'
      : originalTask.title;
    const newTask = {
      id: newTaskId,
      projectId: originalTask.projectId,
      title: `Fork: ${truncatedTitle}`,
      description: originalTask.description,
      status: 'todo' as const,
      position,
      chatInit: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.insert(schema.tasks).values(newTask);
    log.info({ newTaskId, originalTaskId: originalTask.id, checkpointId }, 'Created forked task');

    // Copy attempts BEFORE the checkpoint's attempt (not including it)
    // The user wants to fork from the state before the checkpoint's question was asked
    // so they can re-ask it differently
    const checkpointAttempt = await db.query.attempts.findFirst({
      where: eq(schema.attempts.id, checkpoint.attemptId),
    });
    const originalAttempts = await db.query.attempts.findMany({
      where: and(
        eq(schema.attempts.taskId, originalTask.id),
        lt(schema.attempts.createdAt, checkpointAttempt?.createdAt ?? checkpoint.createdAt)
      ),
      orderBy: [asc(schema.attempts.createdAt)],
    });

    const attemptIdMap = new Map<string, string>(); // old ID -> new ID
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

    log.info({ copiedAttempts: originalAttempts.length, newTaskId }, 'Copied attempts and logs to forked task');

    // Copy checkpoints before the fork point (not including the fork checkpoint itself)
    const originalCheckpoints = await db.query.checkpoints.findMany({
      where: and(
        eq(schema.checkpoints.taskId, originalTask.id),
        lt(schema.checkpoints.createdAt, checkpoint.createdAt)
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

    log.info({ copiedCheckpoints: originalCheckpoints.length, newTaskId }, 'Copied checkpoints to forked task');

    // Set rewind state on the NEW task so its first attempt resumes from the checkpoint
    if (checkpoint.gitCommitHash) {
      await sessionManager.setRewindState(
        newTaskId,
        checkpoint.sessionId,
        checkpoint.gitCommitHash
      );
    }

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
    return NextResponse.json(
      { error: 'Failed to fork from checkpoint' },
      { status: 500 }
    );
  }
}
