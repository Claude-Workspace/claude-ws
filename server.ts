import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { processManager } from './src/lib/process-manager';
import { db, schema } from './src/lib/db';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AttemptStatus, ClaudeOutput } from './src/types';

// Track session IDs for attempts (in-memory for current running attempts)
const attemptSessionIds = new Map<string, string>();

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
      async (data: { taskId: string; prompt: string; displayPrompt?: string }) => {
        const { taskId, prompt, displayPrompt } = data;

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

          // Get the last completed attempt's session_id for conversation continuation
          const lastAttempt = await db.query.attempts.findFirst({
            where: eq(schema.attempts.taskId, taskId),
            orderBy: [desc(schema.attempts.createdAt)],
          });
          const previousSessionId = lastAttempt?.sessionId ?? undefined;

          // Create attempt record
          const attemptId = nanoid();
          await db.insert(schema.attempts).values({
            id: attemptId,
            taskId,
            prompt,
            displayPrompt: displayPrompt || null,
            status: 'running',
          });

          // Update task status to in_progress if it was todo
          if (task.status === 'todo') {
            await db
              .update(schema.tasks)
              .set({ status: 'in_progress', updatedAt: Date.now() })
              .where(eq(schema.tasks.id, taskId));
          }

          // Join attempt room
          socket.join(`attempt:${attemptId}`);

          // Spawn Claude Code process with session resumption if available
          processManager.spawn(attemptId, project.path, prompt, previousSessionId);
          console.log(`[Server] Spawned attempt ${attemptId}${previousSessionId ? ` (resuming session ${previousSessionId})` : ''}`);

          socket.emit('attempt:started', { attemptId, taskId });
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
      const killed = processManager.kill(attemptId);

      if (killed) {
        await db
          .update(schema.attempts)
          .set({ status: 'cancelled', completedAt: Date.now() })
          .where(eq(schema.attempts.id, attemptId));

        io.to(`attempt:${attemptId}`).emit('attempt:finished', {
          attemptId,
          status: 'cancelled',
          code: null,
        });
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

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Forward ProcessManager events to WebSocket clients
  processManager.on('json', async ({ attemptId, data }) => {
    // Extract session_id from system message and store it
    if (data.type === 'system' && data.session_id) {
      attemptSessionIds.set(attemptId, data.session_id);
      console.log(`[Server] Captured session_id for ${attemptId}: ${data.session_id}`);

      // Store session_id in the attempt record
      await db
        .update(schema.attempts)
        .set({ sessionId: data.session_id })
        .where(eq(schema.attempts.id, attemptId));
    }

    // Save to database
    await db.insert(schema.attemptLogs).values({
      attemptId,
      type: 'json',
      content: JSON.stringify(data),
    });

    // Forward to subscribers
    io.to(`attempt:${attemptId}`).emit('output:json', { attemptId, data });
  });

  processManager.on('raw', async ({ attemptId, content }) => {
    await db.insert(schema.attemptLogs).values({
      attemptId,
      type: 'stdout',
      content,
    });

    io.to(`attempt:${attemptId}`).emit('output:raw', { attemptId, content });
  });

  processManager.on('stderr', async ({ attemptId, content }) => {
    await db.insert(schema.attemptLogs).values({
      attemptId,
      type: 'stderr',
      content,
    });

    io.to(`attempt:${attemptId}`).emit('output:stderr', { attemptId, content });
  });

  processManager.on('exit', async ({ attemptId, code }) => {
    const status: AttemptStatus = code === 0 ? 'completed' : 'failed';

    await db
      .update(schema.attempts)
      .set({ status, completedAt: Date.now() })
      .where(eq(schema.attempts.id, attemptId));

    // Clean up in-memory session tracking
    attemptSessionIds.delete(attemptId);

    io.to(`attempt:${attemptId}`).emit('attempt:finished', {
      attemptId,
      status,
      code,
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
