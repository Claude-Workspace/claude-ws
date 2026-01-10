# Brainstorm: Claude Kanban Web Wrapper

**Date:** 2026-01-10
**Status:** Completed
**Topic:** Web UI Kanban board wrapping Claude Code CLI

---

## Problem Statement

Build a Kanban-style web UI that wraps Claude Code CLI, allowing users to:
- Submit prompts via web interface
- View real-time streaming responses from Claude Code
- Manage tasks in Kanban board format (To Do, In Progress, In Review, Done, Cancelled)
- Track multiple attempts per task with diff stats

## Requirements

| Requirement | Decision |
|-------------|----------|
| CLI Location | Local machine (user's) |
| Response Display | Real-time streaming |
| Project Scope | 1 Kanban = 1 project/repo |
| Authentication | User's Claude Code Max subscription |
| Persistence | SQLite |
| Approach | Subprocess wrapper (Approach A) |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Frontend)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Kanban Board │  │ Task Detail │  │ Claude Response     │  │
│  │ (drag-drop)  │  │ (attempts)  │  │ (streaming render)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Local Server (Next.js)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ WS Handler   │  │ Process Mgr  │  │ SQLite + Drizzle │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ spawn + stdio pipes
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code CLI                           │
│              (npx @anthropic-ai/claude-code)                 │
└─────────────────────────────────────────────────────────────┘
```

### Claude Code CLI Integration

**Command:**
```bash
npx -y @anthropic-ai/claude-code@latest \
  -p "<prompt>" \
  --output-format stream-json \
  --input-format stream-json \
  --include-partial-messages \
  --verbose \
  --dangerously-skip-permissions
```

**Key Flags:**
- `--output-format stream-json` - JSON line output, parseable
- `--input-format stream-json` - Accept commands via stdin
- `--include-partial-messages` - Stream partial content during generation
- `--dangerously-skip-permissions` - Skip tool approval prompts (local dev)

### Output Types from Claude Code

```typescript
type ClaudeOutput =
  | { type: 'system'; subtype: string; model: string }
  | { type: 'assistant'; message: { content: ContentBlock[] }; session_id: string }
  | { type: 'tool_use'; tool_name: string; tool_data: ToolData }
  | { type: 'tool_result'; result: string; is_error: boolean }
  | { type: 'stream_event'; event: StreamEvent }
  | { type: 'result'; result: string };
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 15 + React 19 | SSR, App Router, same codebase |
| UI | shadcn/ui + Tailwind | Clean, customizable, Kanban-friendly |
| State | Zustand | Simple, sufficient for local app |
| Backend | Next.js API Routes | Unified codebase |
| WebSocket | Socket.io | Reliable, fallback support |
| Database | SQLite + Drizzle ORM | Type-safe, local-first |
| Process | Node child_process | Native, simple |

---

## Data Model

```sql
-- Projects (workspace config)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Tasks (Kanban cards)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',  -- todo|in_progress|in_review|done|cancelled
  position INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Attempts (each prompt submission per task)
CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status TEXT DEFAULT 'running',  -- running|completed|failed|cancelled
  branch TEXT,
  diff_additions INTEGER DEFAULT 0,
  diff_deletions INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER
);

-- Logs (streaming output chunks)
CREATE TABLE attempt_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id TEXT REFERENCES attempts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- stdout|stderr|json
  content TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX idx_tasks_project ON tasks(project_id, status, position);
CREATE INDEX idx_attempts_task ON attempts(task_id, created_at DESC);
CREATE INDEX idx_logs_attempt ON attempt_logs(attempt_id, created_at);
```

---

## Core Implementation

### Process Manager

```typescript
// lib/process-manager.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface ProcessInstance {
  child: ChildProcess;
  attemptId: string;
  buffer: string;
}

class ProcessManager extends EventEmitter {
  private processes = new Map<string, ProcessInstance>();

  spawn(attemptId: string, projectPath: string, prompt: string): void {
    const child = spawn('npx', [
      '-y', '@anthropic-ai/claude-code@latest',
      '-p', prompt,
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--include-partial-messages',
      '--dangerously-skip-permissions',
    ], {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const instance: ProcessInstance = { child, attemptId, buffer: '' };
    this.processes.set(attemptId, instance);

    child.stdout?.on('data', (chunk) => {
      this.handleOutput(instance, chunk.toString());
    });

    child.stderr?.on('data', (chunk) => {
      this.emit('stderr', { attemptId, content: chunk.toString() });
    });

    child.on('exit', (code) => {
      this.processes.delete(attemptId);
      this.emit('exit', { attemptId, code });
    });
  }

  private handleOutput(instance: ProcessInstance, chunk: string): void {
    instance.buffer += chunk;
    const lines = instance.buffer.split('\n');
    instance.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        this.emit('json', { attemptId: instance.attemptId, data });
      } catch {
        this.emit('raw', { attemptId: instance.attemptId, content: line });
      }
    }
  }

  interrupt(attemptId: string): boolean {
    const instance = this.processes.get(attemptId);
    if (!instance) return false;
    instance.child.stdin?.write('{"type":"interrupt"}\n');
    return true;
  }

  kill(attemptId: string): boolean {
    const instance = this.processes.get(attemptId);
    if (!instance) return false;
    instance.child.kill('SIGTERM');
    this.processes.delete(attemptId);
    return true;
  }

  isRunning(attemptId: string): boolean {
    return this.processes.has(attemptId);
  }
}

export const processManager = new ProcessManager();
```

### WebSocket Handler

```typescript
// app/api/ws/route.ts (or separate ws server)
import { Server } from 'socket.io';
import { processManager } from '@/lib/process-manager';
import { db } from '@/lib/db';

export function setupWebSocket(io: Server) {
  io.on('connection', (socket) => {
    // Start new attempt
    socket.on('attempt:start', async ({ taskId, prompt }) => {
      const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
      const project = await db.query.projects.findFirst({ where: eq(projects.id, task.projectId) });

      const attemptId = crypto.randomUUID();
      await db.insert(attempts).values({ id: attemptId, taskId, prompt, status: 'running' });

      socket.join(`attempt:${attemptId}`);

      processManager.spawn(attemptId, project.path, prompt);
      socket.emit('attempt:started', { attemptId });
    });

    // Cancel attempt
    socket.on('attempt:cancel', ({ attemptId }) => {
      processManager.kill(attemptId);
    });

    // Subscribe to attempt logs
    socket.on('attempt:subscribe', ({ attemptId }) => {
      socket.join(`attempt:${attemptId}`);
    });
  });

  // Forward process events to WebSocket
  processManager.on('json', async ({ attemptId, data }) => {
    io.to(`attempt:${attemptId}`).emit('output:json', { attemptId, data });
    await db.insert(attemptLogs).values({ attemptId, type: 'json', content: JSON.stringify(data) });
  });

  processManager.on('exit', async ({ attemptId, code }) => {
    const status = code === 0 ? 'completed' : 'failed';
    await db.update(attempts).set({ status, completedAt: Date.now() }).where(eq(attempts.id, attemptId));
    io.to(`attempt:${attemptId}`).emit('attempt:finished', { attemptId, status, code });
  });
}
```

### Frontend Hook

```typescript
// hooks/use-attempt-stream.ts
import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/lib/socket-context';

interface ClaudeMessage {
  type: string;
  content?: string;
  tool_name?: string;
  tool_data?: unknown;
}

export function useAttemptStream(attemptId: string | null) {
  const socket = useSocket();
  const [messages, setMessages] = useState<ClaudeMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');

  useEffect(() => {
    if (!attemptId || !socket) return;

    socket.emit('attempt:subscribe', { attemptId });
    setStatus('running');

    const handleJson = ({ data }: { attemptId: string; data: ClaudeMessage }) => {
      setMessages((prev) => [...prev, data]);
    };

    const handleFinished = ({ status }: { status: string }) => {
      setStatus(status as 'completed' | 'failed');
    };

    socket.on('output:json', handleJson);
    socket.on('attempt:finished', handleFinished);

    return () => {
      socket.off('output:json', handleJson);
      socket.off('attempt:finished', handleFinished);
    };
  }, [attemptId, socket]);

  const cancel = useCallback(() => {
    socket?.emit('attempt:cancel', { attemptId });
  }, [socket, attemptId]);

  return { messages, status, cancel };
}
```

---

## Frontend Components Structure

```
src/
├── app/
│   ├── page.tsx                    # Redirect to default project
│   ├── [projectId]/
│   │   └── page.tsx                # Kanban board
│   └── api/
│       └── ...                     # API routes
├── components/
│   ├── kanban/
│   │   ├── board.tsx               # DnD board container
│   │   ├── column.tsx              # Status column
│   │   └── task-card.tsx           # Draggable card
│   ├── task/
│   │   ├── task-detail-panel.tsx   # Right sidebar
│   │   ├── attempt-list.tsx        # Attempts history
│   │   └── prompt-input.tsx        # Submit new prompt
│   └── claude/
│       ├── response-renderer.tsx   # Render Claude output
│       ├── code-block.tsx          # Syntax highlight
│       ├── tool-use-card.tsx       # Show tool calls
│       └── diff-viewer.tsx         # Git diff display
├── hooks/
│   ├── use-attempt-stream.ts
│   ├── use-kanban.ts
│   └── use-project.ts
└── lib/
    ├── db/
    │   ├── schema.ts               # Drizzle schema
    │   └── index.ts                # DB client
    ├── process-manager.ts
    └── socket-context.tsx
```

---

## Implementation Phases

### Phase 1: Core MVP
- [ ] Project setup (Next.js + shadcn/ui + Tailwind)
- [ ] SQLite + Drizzle schema
- [ ] Process manager (spawn, kill)
- [ ] Basic WebSocket streaming
- [ ] Kanban board UI (drag-drop)
- [ ] Task detail panel
- [ ] Claude response renderer (basic markdown)

### Phase 2: Enhanced UX
- [ ] Syntax highlighting for code blocks
- [ ] Tool use visualization
- [ ] Diff viewer component
- [ ] Attempt history/replay
- [ ] Search/filter tasks

### Phase 3: Polish
- [ ] Keyboard shortcuts
- [ ] Dark/light theme
- [ ] Export/import tasks
- [ ] Multiple projects support
- [ ] Settings panel

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Process orphan on crash | Medium | High | PID tracking, cleanup on startup |
| Large output buffer | Low | Medium | Stream directly, don't accumulate |
| Claude Code version mismatch | Medium | Low | Pin version in command |
| WebSocket disconnect | Medium | Medium | Auto-reconnect + replay from DB |
| Long-running tasks | High | Low | Progress indicator, cancel button |

---

## Success Metrics

1. **Functional**: Can submit prompt → see streaming response → task moves to Done
2. **Performance**: Response starts rendering within 500ms of Claude outputting
3. **Reliability**: No orphan processes after 24h of usage
4. **UX**: Drag-drop feels snappy (<100ms feedback)

---

## Unresolved Questions

1. **Session persistence**: Should we maintain Claude Code session across attempts for context? (Current: No, each attempt = fresh process)
2. **Multi-user**: Future consideration for team collaboration?
3. **Branch integration**: Auto-create branch per task? (Current: Skip, code directly)

---

## Next Steps

1. Initialize Next.js project with recommended stack
2. Set up Drizzle + SQLite schema
3. Implement ProcessManager singleton
4. Build Kanban board UI
5. Connect WebSocket streaming
6. Build Claude response renderer

---

*Report generated by Brainstorm Agent*
