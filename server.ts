import 'dotenv/config';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { agentManager } from './src/lib/agent-manager';
import { sessionManager } from './src/lib/session-manager';
import { checkpointManager } from './src/lib/checkpoint-manager';
import { db, schema } from './src/lib/db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AttemptStatus } from './src/types';
import { processAttachments } from './src/lib/file-processor';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port, turbopack: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

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
          const sessionMode = sessionOptions.forkSession
            ? `forking from session ${sessionOptions.forkSession}`
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
      socket.join(`attempt:${data.attemptId}`);
    });

    // Unsubscribe from attempt logs
    socket.on('attempt:unsubscribe', (data: { attemptId: string }) => {
      socket.leave(`attempt:${data.attemptId}`);
    });

    // Handle AskUserQuestion response - start a new attempt with --resume
    socket.on(
      'question:answer',
      async (data: { attemptId: string; answer: string }) => {
        const { attemptId, answer } = data;
        console.log(`[Server] Received answer for ${attemptId}: ${answer}`);

        // Get session ID for the original attempt
        const sessionId = await sessionManager.getSessionId(attemptId);

        if (!sessionId) {
          console.error(`[Server] Session not found for ${attemptId}`);
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        try {
          // Get the original attempt to find taskId
          const originalAttempt = await db.query.attempts.findFirst({
            where: eq(schema.attempts.id, attemptId),
          });

          if (!originalAttempt) {
            socket.emit('error', { message: 'Attempt not found' });
            return;
          }

          // Get task and project info
          const task = await db.query.tasks.findFirst({
            where: eq(schema.tasks.id, originalAttempt.taskId),
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

          // Create new attempt with the answer as prompt
          const newAttemptId = nanoid();
          await db.insert(schema.attempts).values({
            id: newAttemptId,
            taskId: originalAttempt.taskId,
            prompt: answer,
            displayPrompt: `Answer: ${answer}`,
            status: 'running',
          });

          // Join new attempt room
          socket.join(`attempt:${newAttemptId}`);

          // Start new query with resume (continuing current conversation)
          agentManager.start({
            attemptId: newAttemptId,
            projectPath: project.path,
            prompt: answer,
            sessionOptions: { resume: sessionId },
          });

          console.log(`[Server] Started continuation attempt ${newAttemptId} with session ${sessionId}`);

          socket.emit('attempt:started', { attemptId: newAttemptId, taskId: originalAttempt.taskId });
          io.emit('task:started', { taskId: originalAttempt.taskId });
        } catch (error) {
          console.error(`[Server] Error starting continuation:`, error);
          socket.emit('error', { message: 'Failed to continue conversation' });
        }
      }
    );

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Forward AgentManager events to WebSocket clients
  agentManager.on('json', async ({ attemptId, data }) => {
    // Save to database
    await db.insert(schema.attemptLogs).values({
      attemptId,
      type: 'json',
      content: JSON.stringify(data),
    });

    // Forward to subscribers
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

  agentManager.on('exit', async ({ attemptId, code }) => {
    const status: AttemptStatus = code === 0 ? 'completed' : 'failed';

    // Get attempt to retrieve taskId for global event
    const attempt = await db.query.attempts.findFirst({
      where: eq(schema.attempts.id, attemptId),
    });

    await db
      .update(schema.attempts)
      .set({ status, completedAt: Date.now() })
      .where(eq(schema.attempts.id, attemptId));

    // Create checkpoint on successful completion
    if (code === 0 && attempt) {
      try {
        // Clear fork session if this was a forked attempt (after rewind)
        // This prevents re-forking on subsequent attempts
        if (await sessionManager.hasPendingFork(attempt.taskId)) {
          await sessionManager.clearForkSession(attempt.taskId);
          console.log(`[Server] Cleared fork session for task ${attempt.taskId}`);
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

      // Clear fork session on failure too - stale sessions cause API errors
      // This allows next attempt to start fresh instead of repeating fork failure
      if (await sessionManager.hasPendingFork(attempt.taskId)) {
        await sessionManager.clearForkSession(attempt.taskId);
        console.log(`[Server] Cleared stale fork session for task ${attempt.taskId} after failure`);
      }
    }

    console.log(`[Server] Emitting attempt:finished for ${attemptId} with status ${status}`);
    io.to(`attempt:${attemptId}`).emit('attempt:finished', {
      attemptId,
      status,
      code,
    });

    // Global event for all clients to track completed tasks
    if (attempt?.taskId) {
      io.emit('task:finished', { taskId: attempt.taskId, status });
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
