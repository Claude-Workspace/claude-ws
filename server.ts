import 'dotenv/config';

// Enable SDK file checkpointing globally
process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { agentManager } from './src/lib/agent-manager';
import { sessionManager } from './src/lib/session-manager';
import { checkpointManager } from './src/lib/checkpoint-manager';
import { inlineEditManager } from './src/lib/inline-edit-manager';
import { shellManager } from './src/lib/shell-manager';
import { db, schema } from './src/lib/db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AttemptStatus } from './src/types';
import { processAttachments } from './src/lib/file-processor';
import { usageTracker } from './src/lib/usage-tracker';
import { workflowTracker } from './src/lib/workflow-tracker';
import { gitStatsCache } from './src/lib/git-stats-collector';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '8556', 10);

const app = next({ dev, hostname, port, turbopack: false });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Restore running shells from database (survives server restarts)
  const runningShells = await db.query.shells.findMany({
    where: eq(schema.shells.status, 'running'),
  });

  for (const shell of runningShells) {
    const restored = shellManager.restoreFromDb(shell);
    if (!restored) {
      // Shell is no longer running, update database
      await db.update(schema.shells)
        .set({ status: 'crashed', stoppedAt: Date.now() })
        .where(eq(schema.shells.id, shell.id));
    }
  }

  console.log(`[Server] Restored ${shellManager.runningCount} running shells`);

  // Initialize Socket.io
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: dev ? '*' : false,
    },
  });

  // Socket.io connection handler
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Start new attempt
    socket.on(
      'attempt:start',
      async (data: { taskId: string; prompt: string; displayPrompt?: string; fileIds?: string[] }) => {
        const { taskId, prompt, displayPrompt, fileIds = [] } = data;

        try {
          // Get task and project info
          const task = await db.query.tasks.findFirst({
            where: eq(schema.tasks.id, taskId),
          });

          if (!task) {
            socket.emit('error', { message: 'Task not found' });
            return;
          }

          const project = await db.query.projects.findFirst({
            where: eq(schema.projects.id, task.projectId),
          });

          if (!project) {
            socket.emit('error', { message: 'Project not found' });
            return;
          }

          // Get session options for conversation continuation
          // Returns { forkSession } if task was rewound, otherwise { resume }
          const sessionOptions = await sessionManager.getSessionOptions(taskId);

          // Create attempt record
          const attemptId = nanoid();
          await db.insert(schema.attempts).values({
            id: attemptId,
            taskId,
            prompt,
            displayPrompt: displayPrompt || null,
            status: 'running',
          });

          // Process file attachments if any
          let filePaths: string[] = [];
          if (fileIds.length > 0) {
            console.log(`[Server] Processing ${fileIds.length} file attachments for attempt ${attemptId}`);
            const processedFiles = await processAttachments(attemptId, fileIds);
            filePaths = processedFiles.map(f => f.absolutePath);
            console.log(`[Server] Processed ${processedFiles.length} files`);
          }

          // Update task status to in_progress if it was todo
          if (task.status === 'todo') {
            await db
              .update(schema.tasks)
              .set({ status: 'in_progress', updatedAt: Date.now() })
              .where(eq(schema.tasks.id, taskId));
          }

          // Join attempt room
          socket.join(`attempt:${attemptId}`);

          // Start Claude Agent SDK query
          agentManager.start({
            attemptId,
            projectPath: project.path,
            prompt,
            sessionOptions: Object.keys(sessionOptions).length > 0 ? sessionOptions : undefined,
            filePaths: filePaths.length > 0 ? filePaths : undefined,
          });

          // Log session mode
          const sessionMode = sessionOptions.resumeSessionAt
            ? `resuming at message ${sessionOptions.resumeSessionAt}`
            : sessionOptions.resume
              ? `resuming session ${sessionOptions.resume}`
              : 'new session';
          console.log(`[Server] Started attempt ${attemptId} (${sessionMode})${filePaths.length > 0 ? ` with ${filePaths.length} files` : ''}`);

          socket.emit('attempt:started', { attemptId, taskId });
          // Global event for all clients to track running tasks
          io.emit('task:started', { taskId });
        } catch (error) {
          console.error('Error starting attempt:', error);
          socket.emit('error', {
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    );

    // Cancel/kill attempt
    socket.on('attempt:cancel', async (data: { attemptId: string }) => {
      const { attemptId } = data;
      const cancelled = agentManager.cancel(attemptId);

      if (cancelled) {
        // Get attempt to retrieve taskId for global event
        const attempt = await db.query.attempts.findFirst({
          where: eq(schema.attempts.id, attemptId),
        });

        await db
          .update(schema.attempts)
          .set({ status: 'cancelled', completedAt: Date.now() })
          .where(eq(schema.attempts.id, attemptId));

        // Clear checkpoint tracking
        checkpointManager.clearAttemptCheckpoint(attemptId);

        io.to(`attempt:${attemptId}`).emit('attempt:finished', {
          attemptId,
          status: 'cancelled',
          code: null,
        });

        // Global event for all clients to track cancelled tasks
        if (attempt?.taskId) {
          io.emit('task:finished', { taskId: attempt.taskId, status: 'cancelled' });
        }
      }
    });

    // Subscribe to attempt logs
    socket.on('attempt:subscribe', (data: { attemptId: string }) => {
      console.log(`[Server] Socket ${socket.id} subscribing to attempt:${data.attemptId}`);
      socket.join(`attempt:${data.attemptId}`);
    });

    // Unsubscribe from attempt logs
    socket.on('attempt:unsubscribe', (data: { attemptId: string }) => {
      socket.leave(`attempt:${data.attemptId}`);
    });

    // Handle AskUserQuestion response - resolve pending canUseTool callback
    socket.on(
      'question:answer',
      async (data: { attemptId: string; questions: unknown[]; answers: Record<string, string> }) => {
        const { attemptId, questions, answers } = data;
        console.log(`[Server] Received answer for ${attemptId}:`, answers);

        // Check if there's a pending question (canUseTool callback waiting)
        if (agentManager.hasPendingQuestion(attemptId)) {
          // Resolve the pending Promise - SDK will resume streaming
          const success = agentManager.answerQuestion(attemptId, questions, answers);
          if (success) {
            console.log(`[Server] Resumed streaming for ${attemptId}`);
          } else {
            console.error(`[Server] Failed to answer question for ${attemptId}`);
            socket.emit('error', { message: 'Failed to answer question' });
          }
        } else {
          // Fallback: No pending question (legacy behavior or reconnection)
          console.warn(`[Server] No pending question for ${attemptId}, attempting legacy flow`);
          socket.emit('error', { message: 'No pending question found' });
        }
      }
    );

    // Handle AskUserQuestion cancellation
    socket.on(
      'question:cancel',
      async (data: { attemptId: string }) => {
        const { attemptId } = data;
        console.log(`[Server] Cancelling question for ${attemptId}`);

        if (agentManager.hasPendingQuestion(attemptId)) {
          agentManager.cancelQuestion(attemptId);
          console.log(`[Server] Question cancelled for ${attemptId}`);
        }
      }
    );

    // ========================================
    // Inline Edit Socket Handlers
    // ========================================

    // Subscribe to inline edit session (with acknowledgment)
    socket.on('inline-edit:subscribe', (data: { sessionId: string }, ack?: (ok: boolean) => void) => {
      console.log(`[Server] Socket ${socket.id} subscribing to inline-edit:${data.sessionId}`);
      socket.join(`inline-edit:${data.sessionId}`);
      // Send acknowledgment that subscription is complete
      if (ack) ack(true);
    });

    // Start inline edit session (moved from API route to avoid module context issues)
    socket.on('inline-edit:start', async (data: {
      sessionId: string;
      basePath: string;
      filePath: string;
      language: string;
      selectedCode: string;
      instruction: string;
    }, ack?: (result: { success: boolean; error?: string }) => void) => {
      console.log(`[Server] Starting inline edit session ${data.sessionId}`);
      try {
        await inlineEditManager.startEdit({
          sessionId: data.sessionId,
          basePath: data.basePath,
          filePath: data.filePath,
          language: data.language || 'text',
          selectedCode: data.selectedCode,
          instruction: data.instruction,
        });
        if (ack) ack({ success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to start edit';
        console.error(`[Server] Inline edit start error:`, errorMsg);
        if (ack) ack({ success: false, error: errorMsg });
      }
    });

    // Cancel inline edit session
    socket.on('inline-edit:cancel', (data: { sessionId: string }) => {
      console.log(`[Server] Cancelling inline edit session ${data.sessionId}`);
      inlineEditManager.cancelEdit(data.sessionId);
    });

    // ========================================
    // Shell Socket Handlers
    // ========================================

    // Subscribe to shell events for a project
    socket.on('shell:subscribe', (data: { projectId: string }) => {
      console.log(`[Server] Socket ${socket.id} subscribing to shell:project:${data.projectId}`);
      socket.join(`shell:project:${data.projectId}`);
    });

    // Unsubscribe from shell events
    socket.on('shell:unsubscribe', (data: { projectId: string }) => {
      socket.leave(`shell:project:${data.projectId}`);
    });

    // Stop a running shell
    socket.on('shell:stop', async (data: { shellId: string }, ack?: (result: { success: boolean; error?: string }) => void) => {
      console.log(`[Server] Stopping shell ${data.shellId}`);
      try {
        const success = shellManager.stop(data.shellId);
        if (success) {
          // Update database
          await db.update(schema.shells)
            .set({ status: 'stopped', stoppedAt: Date.now() })
            .where(eq(schema.shells.id, data.shellId));
        }
        if (ack) ack({ success });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to stop shell';
        console.error(`[Server] Shell stop error:`, errorMsg);
        if (ack) ack({ success: false, error: errorMsg });
      }
    });

    // Get logs for a specific shell
    socket.on('shell:getLogs', (
      data: { shellId: string; lines?: number },
      ack?: (result: { logs: Array<{ type: 'stdout' | 'stderr'; content: string; timestamp: number }>; error?: string }) => void
    ) => {
      try {
        const logs = shellManager.getRecentLogs(data.shellId, data.lines || 100);
        if (ack) ack({ logs });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to get logs';
        console.error(`[Server] Shell getLogs error:`, errorMsg);
        if (ack) ack({ logs: [], error: errorMsg });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // ========================================
  // Inline Edit Manager Event Handlers
  // ========================================
  console.log('[Server] Setting up inlineEditManager event handlers, instance ID:', (inlineEditManager as unknown as { _id?: string })._id);

  // Forward inline edit deltas to subscribers
  inlineEditManager.on('delta', ({ sessionId, chunk }) => {
    io.to(`inline-edit:${sessionId}`).emit('inline-edit:delta', { sessionId, chunk });
  });

  // Forward inline edit completion to subscribers
  inlineEditManager.on('complete', ({ sessionId, code, diff }) => {
    const room = `inline-edit:${sessionId}`;
    const sockets = io.sockets.adapter.rooms.get(room);
    console.log(`[Server] Inline edit ${sessionId} completed, ${code.length} chars, room ${room} has ${sockets?.size || 0} sockets`);
    io.to(room).emit('inline-edit:complete', { sessionId, code, diff });
  });

  // Forward inline edit errors to subscribers
  inlineEditManager.on('error', ({ sessionId, error }) => {
    console.error(`[Server] Inline edit ${sessionId} error:`, error);
    io.to(`inline-edit:${sessionId}`).emit('inline-edit:error', { sessionId, error });
  });

  // ========================================
  // Shell Manager Event Handlers
  // ========================================

  // Forward shell started events
  shellManager.on('started', ({ shellId, projectId, pid, command }) => {
    console.log(`[Server] Shell ${shellId} started with PID ${pid}`);
    io.to(`shell:project:${projectId}`).emit('shell:started', { shellId, projectId, pid, command });
  });

  // Forward shell output to subscribers
  shellManager.on('output', ({ shellId, projectId, type, content }) => {
    io.to(`shell:project:${projectId}`).emit('shell:output', { shellId, projectId, type, content });
  });

  // Forward shell exit events
  shellManager.on('exit', async ({ shellId, projectId, code, signal }) => {
    console.log(`[Server] Shell ${shellId} exited with code ${code}, signal ${signal}`);
    io.to(`shell:project:${projectId}`).emit('shell:exit', { shellId, projectId, code, signal });

    // Update database
    try {
      await db.update(schema.shells)
        .set({
          status: code === 0 ? 'stopped' : 'crashed',
          exitCode: code,
          exitSignal: signal,
          stoppedAt: Date.now(),
        })
        .where(eq(schema.shells.id, shellId));
    } catch (error) {
      console.error(`[Server] Failed to update shell ${shellId} in database:`, error);
    }
  });

  // Forward AgentManager events to WebSocket clients
  agentManager.on('json', async ({ attemptId, data }) => {
    // Skip saving streaming deltas - they're intermediate state
    // Complete assistant messages will have full text/thinking
    const isStreamingDelta = data.type === 'content_block_delta';

    if (!isStreamingDelta) {
      // Save to database (only complete messages)
      await db.insert(schema.attemptLogs).values({
        attemptId,
        type: 'json',
        content: JSON.stringify(data),
      });
    }

    // Check how many clients are in the room
    const room = io.sockets.adapter.rooms.get(`attempt:${attemptId}`);
    const clientCount = room ? room.size : 0;
    if (!isStreamingDelta) {
      console.log(`[Server] Emitting output:json to attempt:${attemptId} (${clientCount} clients in room)`, data.type);
    }

    // Always forward to subscribers (for real-time streaming)
    io.to(`attempt:${attemptId}`).emit('output:json', { attemptId, data });
  });

  agentManager.on('stderr', async ({ attemptId, content }) => {
    await db.insert(schema.attemptLogs).values({
      attemptId,
      type: 'stderr',
      content,
    });

    io.to(`attempt:${attemptId}`).emit('output:stderr', { attemptId, content });
  });

  // Handle AskUserQuestion detection from AgentManager
  agentManager.on('question', ({ attemptId, toolUseId, questions }) => {
    console.log(`[Server] AskUserQuestion detected for ${attemptId}`);
    io.to(`attempt:${attemptId}`).emit('question:ask', {
      attemptId,
      toolUseId,
      questions,
    });
  });

  // Handle background shell detection from AgentManager (Bash with run_in_background=true)
  agentManager.on('backgroundShell', async ({ attemptId, shell }) => {
    console.log(`[Server] Background shell detected for ${attemptId}: ${shell.command}`);

    try {
      // Get attempt to find project info
      const attempt = await db.query.attempts.findFirst({
        where: eq(schema.attempts.id, attemptId),
      });

      if (!attempt) {
        console.error(`[Server] Attempt ${attemptId} not found for background shell`);
        return;
      }

      const task = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, attempt.taskId),
      });

      if (!task) {
        console.error(`[Server] Task not found for attempt ${attemptId}`);
        return;
      }

      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, task.projectId),
      });

      if (!project) {
        console.error(`[Server] Project not found for task ${task.id}`);
        return;
      }

      // Spawn the shell using ShellManager
      const shellId = shellManager.spawn({
        projectId: project.id,
        attemptId,
        command: shell.command,
        cwd: project.path,
        description: shell.description,
      });

      // Save to database
      await db.insert(schema.shells).values({
        id: shellId,
        projectId: project.id,
        attemptId,
        command: shell.command,
        cwd: project.path,
        pid: shellManager.getShell(shellId)?.pid,
        status: 'running',
      });

      console.log(`[Server] Spawned background shell ${shellId} for project ${project.id}`);
    } catch (error) {
      console.error(`[Server] Failed to spawn background shell:`, error);
    }
  });

  agentManager.on('exit', async ({ attemptId, code }) => {
    const status: AttemptStatus = code === 0 ? 'completed' : 'failed';

    // Get attempt to retrieve taskId for global event
    const attempt = await db.query.attempts.findFirst({
      where: eq(schema.attempts.id, attemptId),
    });

    if (!attempt) {
      console.error(`[Server] Attempt ${attemptId} not found`);
      return;
    }

    // Get usage stats from tracker
    const usageStats = usageTracker.getUsage(attemptId);
    const gitStatsData = gitStatsCache.get(attemptId);

    // Update attempt with status and usage stats
    await db
      .update(schema.attempts)
      .set({
        status,
        completedAt: Date.now(),
        // Save usage stats
        ...(usageStats && {
          totalTokens: usageStats.totalTokens,
          inputTokens: usageStats.totalInputTokens,
          outputTokens: usageStats.totalOutputTokens,
          cacheCreationTokens: usageStats.totalCacheCreationTokens,
          cacheReadTokens: usageStats.totalCacheReadTokens,
          totalCostUSD: usageStats.totalCostUSD.toString(),
          numTurns: usageStats.numTurns,
          durationMs: usageStats.durationMs,
          // Context usage (calculated from cache_read_input_tokens)
          contextUsed: usageStats.contextUsed,
          contextLimit: usageStats.contextLimit,
          contextPercentage: Math.round(usageStats.contextPercentage),
          baselineContext: usageStats.baselineContext,
        }),
        // Save git stats
        ...(gitStatsData && {
          diffAdditions: gitStatsData.additions,
          diffDeletions: gitStatsData.deletions,
        }),
      })
      .where(eq(schema.attempts.id, attemptId));

    // Create checkpoint on successful completion
    if (code === 0 && attempt) {
      try {
        // Clear rewind state if this was a rewound attempt
        // This prevents re-rewinding on subsequent attempts
        if (await sessionManager.hasPendingRewind(attempt.taskId)) {
          await sessionManager.clearRewindState(attempt.taskId);
          console.log(`[Server] Cleared rewind state for task ${attempt.taskId}`);
        }

        const sessionId = await sessionManager.getSessionId(attemptId);

        if (sessionId) {
          // Count messages in this attempt
          const logs = await db.query.attemptLogs.findMany({
            where: eq(schema.attemptLogs.attemptId, attemptId),
          });

          // Extract summary from last assistant message
          const summary = extractSummary(logs);

          // Save checkpoint using CheckpointManager
          await checkpointManager.saveCheckpoint(
            attemptId,
            attempt.taskId,
            sessionId,
            logs.filter((l) => l.type === 'json').length,
            summary
          );
        }
      } catch (error) {
        console.error(`[Server] Failed to create checkpoint for ${attemptId}:`, error);
      }
    } else if (attempt) {
      // Clear checkpoint tracking on failure
      checkpointManager.clearAttemptCheckpoint(attemptId);

      // Clear rewind state on failure too - stale sessions cause API errors
      // This allows next attempt to start fresh instead of repeating failure
      if (await sessionManager.hasPendingRewind(attempt.taskId)) {
        await sessionManager.clearRewindState(attempt.taskId);
        console.log(`[Server] Cleared stale rewind state for task ${attempt.taskId} after failure`);
      }
    }

    console.log(`[Server] Emitting attempt:finished for ${attemptId} with status ${status}`);
    io.to(`attempt:${attemptId}`).emit('attempt:finished', {
      attemptId,
      status,
      code,
    });

    // Emit git stats if available
    const gitStats = gitStatsCache.get(attemptId);
    if (gitStats) {
      console.log(`[Server] Emitting status:git for ${attemptId}: +${gitStats.additions} -${gitStats.deletions}`);
      io.to(`attempt:${attemptId}`).emit('status:git', {
        attemptId,
        stats: gitStats,
      });
    }

    // Global event for all clients to track completed tasks
    if (attempt?.taskId) {
      io.emit('task:finished', { taskId: attempt.taskId, status });
    }
  });

  // Forward tracking module events to Socket.io clients
  // Usage tracking (tokens, costs, model usage)
  usageTracker.on('usage-update', ({ attemptId, usage }) => {
    console.log(`[Server] Emitting status:usage for ${attemptId}:`, usage.totalTokens, 'tokens');
    io.to(`attempt:${attemptId}`).emit('status:usage', {
      attemptId,
      usage,
    });
  });

  // Workflow tracking (subagent execution chain)
  workflowTracker.on('workflow-update', ({ attemptId, workflow }) => {
    const summary = workflowTracker.getWorkflowSummary(attemptId);
    if (summary) {
      console.log(`[Server] Emitting status:workflow for ${attemptId}:`, summary.chain);
      io.to(`attempt:${attemptId}`).emit('status:workflow', {
        attemptId,
        workflow: summary,
      });
    }
  });

  // Extract summary from last assistant message
  function extractSummary(logs: { type: string; content: string }[]): string {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].type === 'json') {
        try {
          const data = JSON.parse(logs[i].content);
          if (data.type === 'assistant' && data.message?.content) {
            const text = data.message.content
              .filter((b: { type: string }) => b.type === 'text')
              .map((b: { text: string }) => b.text)
              .join(' ');
            return text.substring(0, 100) + (text.length > 100 ? '...' : '');
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    return '';
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\n> ${signal} received, shutting down gracefully...`);

    // Cancel all Claude agents first
    agentManager.cancelAll();
    console.log('> Cancelled all Claude agents');

    // Close all socket connections
    io.close(() => {
      console.log('> Socket.io closed');
    });

    // Close HTTP server
    httpServer.close(() => {
      console.log('> HTTP server closed');
      process.exit(0);
    });

    // Force exit after 5 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('> Forced exit after timeout');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
});
