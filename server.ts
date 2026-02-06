import 'dotenv/config';

// Load ~/.claude/settings.json env vars as fallback
// This ensures SDK subprocess has API key even if not in .env
import { applyClaudeCodeSettingsFallback } from './src/lib/claude-code-settings';
applyClaudeCodeSettingsFallback();

// Initialize Anthropic proxy BEFORE importing agent-manager or SDK
// This redirects all Anthropic API calls through our proxy for token caching
import { initAnthropicProxy } from './src/lib/anthropic-proxy-setup';
initAnthropicProxy();

// Import logCacheStats from shared cache module for monitoring
import { logCacheStats } from './src/lib/proxy-token-cache';

// Enable SDK file checkpointing globally
process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { homedir } from 'os';
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
import { tunnelService } from './src/lib/tunnel-service';

import { getPort, getHostname } from './src/lib/server-port-configuration';

const dev = process.env.NODE_ENV !== 'production';
const hostname = getHostname();
const port = getPort();

const app = next({ dev, hostname, port, turbopack: false });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    const pathname = parsedUrl.pathname || '';

    // API authentication check - read from process.env directly for immediate effect
    const apiAccessKey = process.env.API_ACCESS_KEY;
    const isApiRoute = pathname.startsWith('/api/');
    const isVerifyEndpoint = pathname === '/api/auth/verify';
    const isProxyEndpoint = pathname.startsWith('/api/proxy/anthropic');
    const isTunnelStatusEndpoint = pathname === '/api/tunnel/status';
    const isApiAccessKeyEndpoint = pathname === '/api/settings/api-access-key';

    // Skip auth for verify, tunnel status, and api-access-key endpoints
    if (isApiRoute && !isVerifyEndpoint && !isProxyEndpoint && !isTunnelStatusEndpoint && !isApiAccessKeyEndpoint && apiAccessKey && apiAccessKey.length > 0) {
      const providedKey = req.headers['x-api-key'];

      if (!providedKey || providedKey !== apiAccessKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', message: 'Valid API key required' }));
        return;
      }
    }

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
    // Keep connections alive through Cloudflare Tunnel (100s idle timeout)
    pingInterval: 10000,
    pingTimeout: 10000,
  });

  // Socket.io connection handler
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Start new attempt
    socket.on(
      'attempt:start',
      async (data: {
        taskId: string;
        prompt: string;
        displayPrompt?: string;
        fileIds?: string[];
        force_create?: boolean;
        projectId?: string;
        projectName?: string;
        taskTitle?: string;
        projectRootPath?: string;
        outputFormat?: 'json' | 'html' | 'markdown' | 'yaml' | 'raw' | 'custom';
        outputSchema?: string;
        model?: string;  // Optional: model ID for this attempt
      }) => {
        const {
          taskId,
          prompt,
          displayPrompt,
          fileIds = [],
          force_create,
          projectId,
          projectName,
          taskTitle,
          projectRootPath,
          outputFormat,
          outputSchema,
          model
        } = data;

        console.log('[Socket] attempt:start received:', {
          taskId,
          prompt,
          force_create,
          projectId,
          projectName,
          taskTitle,
          projectRootPath,
          outputFormat,
          hasOutputSchema: !!outputSchema
        });

        try {
          let task = await db.query.tasks.findFirst({
            where: eq(schema.tasks.id, taskId),
          });

          // Handle force_create logic
          if (force_create && !task) {
            console.log('[Socket] Task not found, force_create=true');

            if (!projectId) {
              socket.emit('error', { message: 'projectId required' });
              return;
            }

            // Check if project exists
            let project = await db.query.projects.findFirst({
              where: eq(schema.projects.id, projectId),
            });

            console.log('[Socket] Project exists?', !!project);

            // Create project if it doesn't exist
            if (!project) {
              console.log('[Socket] Project does not exist, checking projectName...');
              console.log('[Socket] projectName value:', projectName);

              if (!projectName || projectName.trim() === '') {
                console.log('[Socket] Project name required but not provided');
                socket.emit('error', { message: 'projectName required' });
                return;
              }

              // Create project directory and record
              const { mkdir } = await import('fs/promises');
              const { join } = await import('path');

              const projectDirName = `${projectId}-${projectName}`;
              const projectPath = projectRootPath
                ? join(projectRootPath, projectDirName)
                : join(process.cwd(), 'data', 'projects', projectDirName);

              try {
                await mkdir(projectPath, { recursive: true });
                console.log('[Socket] Created project directory:', projectPath);
              } catch (mkdirError: any) {
                if (mkdirError?.code !== 'EEXIST') {
                  console.error('[Socket] Failed to create project folder:', mkdirError);
                  socket.emit('error', { message: 'Failed to create project folder: ' + mkdirError.message });
                  return;
                }
              }

              try {
                await db.insert(schema.projects).values({
                  id: projectId,
                  name: projectName,
                  path: projectPath,
                  createdAt: Date.now(),
                });
                console.log('[Socket] Created project:', projectId);
              } catch (error) {
                console.error('[Socket] Failed to create project:', error);
                socket.emit('error', { message: 'Failed to create project' });
                return;
              }

              // Project created, fetch it
              project = await db.query.projects.findFirst({
                where: eq(schema.projects.id, projectId),
              });
            }

            // Check taskTitle
            if (!taskTitle || taskTitle.trim() === '') {
              console.log('[Socket] Task title required but not provided');
              socket.emit('error', { message: 'taskTitle required' });
              return;
            }

            // Create task
            const { and, desc } = await import('drizzle-orm');

            // Get next position for todo status
            const tasksInStatus = await db
              .select()
              .from(schema.tasks)
              .where(
                and(
                  eq(schema.tasks.projectId, projectId),
                  eq(schema.tasks.status, 'todo')
                )
              )
              .orderBy(desc(schema.tasks.position))
              .limit(1);

            const position = tasksInStatus.length > 0 ? tasksInStatus[0].position + 1 : 0;

            try {
              await db.insert(schema.tasks).values({
                id: taskId,
                projectId,
                title: taskTitle,
                description: null,
                status: 'todo',
                position,
                chatInit: false,
                rewindSessionId: null,
                rewindMessageUuid: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              console.log('[Socket] Created task:', taskId);

              // Fetch the created task
              task = await db.query.tasks.findFirst({
                where: eq(schema.tasks.id, taskId),
              });
            } catch (error) {
              console.error('[Socket] Failed to create task:', error);
              socket.emit('error', { message: 'Failed to create task' });
              return;
            }
          }

          // Validate task exists
          if (!task) {
            socket.emit('error', { message: 'Task not found' });
            return;
          }

          // Get project info
          const project = await db.query.projects.findFirst({
            where: eq(schema.projects.id, task.projectId),
          });

          if (!project) {
            socket.emit('error', { message: 'Project not found' });
            return;
          }

          // Get session options for conversation continuation
          // Uses auto-fix to detect and skip past API errors in corrupted sessions
          const sessionOptions = await sessionManager.getSessionOptionsWithAutoFix(taskId);

          // Create attempt record
          const attemptId = nanoid();
          await db.insert(schema.attempts).values({
            id: attemptId,
            taskId,
            prompt,
            displayPrompt: displayPrompt || null,
            status: 'running',
            outputFormat: outputFormat || null,
            outputSchema: outputSchema || null,
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
            model: model || undefined,  // Pass model to agent-manager
            sessionOptions: Object.keys(sessionOptions).length > 0 ? sessionOptions : undefined,
            filePaths: filePaths.length > 0 ? filePaths : undefined,
            outputFormat,
            outputSchema,
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

      // Try to cancel in-memory agent (may not exist if server restarted)
      agentManager.cancel(attemptId);

      // Always update DB status - handles both in-memory and stale attempts
      // Get attempt to retrieve taskId for global event
      const attempt = await db.query.attempts.findFirst({
        where: eq(schema.attempts.id, attemptId),
      });

      if (attempt && attempt.status === 'running') {
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
        if (attempt.taskId) {
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
  agentManager.on('started', ({ attemptId, taskId }) => {
    console.log(`[Server] Agent started for attempt ${attemptId}, task ${taskId}`);
    // Emit to all clients so they can subscribe if they're viewing this task
    io.emit('attempt:started', { attemptId, taskId });
  });

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
    console.log(`[Server] AskUserQuestion detected for ${attemptId}`, {
      toolUseId,
      questionCount: questions?.length,
      questions: questions?.map((q: any) => ({ header: q.header, question: q.question?.substring(0, 50) }))
    });
    io.to(`attempt:${attemptId}`).emit('question:ask', {
      attemptId,
      toolUseId,
      questions,
    });
    console.log(`[Server] Emitted question:ask to attempt:${attemptId}`);
  });

  // Handle background shell detection from AgentManager (Bash with run_in_background=true)
  // NOTE: SDK spawns process but it dies when conversation ends.
  // We spawn our own detached shell that survives.
  // The command should kill existing processes first to avoid port conflicts.
  agentManager.on('backgroundShell', async ({ attemptId, shell }) => {
    console.log(`[Server] Background shell detected for ${attemptId}: ${shell.command}`);

    try {
      const attempt = await db.query.attempts.findFirst({
        where: eq(schema.attempts.id, attemptId),
      });
      if (!attempt) return;

      const task = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, attempt.taskId),
      });
      if (!task) return;

      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, task.projectId),
      });
      if (!project) return;

      // Extract port and find existing process PID
      // Add delay to let nohup process bind to port before checking
      const portMatch = shell.originalCommand?.match(/lsof\s+-ti\s+:(\d+)/);
      if (portMatch) {
        const port = portMatch[1];
        console.log(`[Server] Waiting 6.6s for process to bind to port ${port}...`);
        await new Promise(resolve => setTimeout(resolve, 6666));
        try {
          const { execSync } = require('child_process');
          const pidOutput = execSync(`lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
          if (pidOutput) {
            const pid = parseInt(pidOutput.split('\n')[0], 10);
            if (pid) {
              // Track existing process instead of respawning
              console.log(`[Server] Found existing process on port ${port}: PID ${pid}`);
              const shellId = shellManager.trackExternalProcess({
                projectId: project.id,
                attemptId,
                pid,
                command: shell.command,
                cwd: project.path,
              });

              if (shellId) {
                await db.insert(schema.shells).values({
                  id: shellId,
                  projectId: project.id,
                  attemptId,
                  command: shell.command,
                  cwd: project.path,
                  pid,
                  status: 'running',
                });
                console.log(`[Server] Tracking external process ${shellId} (PID ${pid})`);
                return;
              }
            }
          }
        } catch {
          // Fall through to spawn new shell
        }
      }

      // No existing process found, spawn new shell
      const shellId = shellManager.spawn({
        projectId: project.id,
        attemptId,
        command: shell.command,
        cwd: project.path,
        description: shell.description,
      });

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

  // Handle tracked process from BGPID pattern in bash output
  // Track existing process instead of kill-and-respawn to avoid port conflicts
  agentManager.on('trackedProcess', async ({ attemptId, pid, command, logFile: eventLogFile }) => {
    console.log(`[Server] Tracked process detected for ${attemptId}: PID ${pid}`);

    try {
      const attempt = await db.query.attempts.findFirst({
        where: eq(schema.attempts.id, attemptId),
      });

      if (!attempt) {
        console.error(`[Server] Cannot track process: attempt not found`);
        return;
      }

      const task = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, attempt.taskId),
      });

      if (!task) {
        console.error(`[Server] Cannot track process: task not found`);
        return;
      }

      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, task.projectId),
      });

      if (!project) {
        console.error(`[Server] Cannot track process: project not found`);
        return;
      }

      // Extract actual command from nohup wrapper, use eventLogFile if provided
      let actualCommand = command;
      let logFile = eventLogFile;
      const nohupMatch = command.match(/nohup\s+(.+?)\s*>\s*(\/tmp\/[^\s]+\.log)/);
      if (nohupMatch) {
        actualCommand = nohupMatch[1].trim();
        logFile = logFile || nohupMatch[2];
      }
      console.log(`[Server] Extracted command: ${actualCommand}, logFile: ${logFile}`);

      // Track existing process via ShellManager (no kill-and-respawn)
      const shellId = shellManager.trackExternalProcess({
        projectId: project.id,
        attemptId,
        pid,
        command: actualCommand,
        cwd: project.path,
        logFile,
      });

      if (!shellId) {
        console.error(`[Server] Failed to track process: PID ${pid} not alive`);
        return;
      }

      // Save to database for persistence
      await db.insert(schema.shells).values({
        id: shellId,
        projectId: project.id,
        attemptId,
        command: actualCommand,
        cwd: project.path,
        pid,
        status: 'running',
      });

      console.log(`[Server] Tracking external process ${shellId} (PID ${pid}) for project ${project.id}`);
    } catch (error) {
      console.error(`[Server] Failed to track process:`, error);
    }
  });

  // Register exit event handler
  agentManager.on('exit', async ({ attemptId, code }) => {
    // Get attempt to retrieve taskId and current status
    const attempt = await db.query.attempts.findFirst({
      where: eq(schema.attempts.id, attemptId),
    });

    if (!attempt) {
      console.error(`[Server] Attempt ${attemptId} not found`);
      return;
    }

    // Preserve 'cancelled' status - don't overwrite if user cancelled
    // The cancel handler already set the correct status
    const status: AttemptStatus = attempt.status === 'cancelled'
      ? 'cancelled'
      : (code === 0 ? 'completed' : 'failed');

    // Get usage stats from tracker
    const usageStats = usageTracker.getUsage(attemptId);
    const gitStatsData = gitStatsCache.get(attemptId);

    // Update attempt with status and usage stats
    // IMPORTANT: Clear session_id on failure to prevent next attempt from resuming
    // a corrupted/empty session. Failed sessions may have incomplete data that causes
    // Claude Code to exit with code 1 when resuming.
    await db
      .update(schema.attempts)
      .set({
        status,
        completedAt: Date.now(),
        // Clear session_id on failure - prevents resume from corrupted sessions
        ...(status === 'failed' && { sessionId: null }),
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

      // Log session clearing for debugging
      console.log(`[Server] Attempt ${attemptId} failed - session_id cleared to prevent resume from corrupted session`);

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

  // ========================================
  // Tunnel Service Event Handlers
  // ========================================

  // Forward tunnel status changes to all clients
  tunnelService.on('status', (state) => {
    io.emit('tunnel:status', state);
  });

  tunnelService.on('connected', ({ url }) => {
    console.log(`[Server] Tunnel connected: ${url}`);
    io.emit('tunnel:connected', { url });
  });

  tunnelService.on('error', ({ error }) => {
    console.error(`[Server] Tunnel error: ${error}`);
    io.emit('tunnel:error', { error });
  });

  tunnelService.on('closed', () => {
    console.log('[Server] Tunnel closed');
    io.emit('tunnel:closed');
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);

    // Try to auto-reconnect tunnel after server is ready
    tunnelService.tryAutoReconnect().catch((err) => {
      console.error('[Server] Failed to auto-reconnect tunnel:', err);
    });

    // Log cache stats every 5 minutes for monitoring
    setInterval(() => {
      logCacheStats();
    }, 5 * 60 * 1000).unref();
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\n> ${signal} received, shutting down gracefully...`);

    // Stop tunnel
    await tunnelService.stop();
    console.log('> Tunnel stopped');

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
