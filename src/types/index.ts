// Task status types for Kanban board
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';

// Attempt status types
export type AttemptStatus = 'running' | 'completed' | 'failed' | 'cancelled';

// Project type
export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

// Task type for Kanban cards
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  chatInit: boolean;
  createdAt: number;
  updatedAt: number;
}

// Attempt type for Claude interactions
export interface Attempt {
  id: string;
  taskId: string;
  prompt: string;
  status: AttemptStatus;
  sessionId: string | null; // Claude CLI session ID for --resume
  branch: string | null;
  diffAdditions: number;
  diffDeletions: number;
  createdAt: number;
  completedAt: number | null;
}

// Log entry type
export interface AttemptLog {
  id: number;
  attemptId: string;
  type: 'stdout' | 'stderr' | 'json';
  content: string;
  createdAt: number;
}

// Claude output types
export type ClaudeOutputType =
  | 'system'
  | 'assistant'
  | 'user'
  | 'tool_use'
  | 'tool_result'
  | 'stream_event'
  | 'content_block_delta'
  | 'result';

export interface ClaudeContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

export interface ClaudeMessage {
  role?: string;
  content?: ClaudeContentBlock[];
}

export interface ClaudeOutput {
  type: ClaudeOutputType;
  id?: string;
  tool_use_id?: string;
  subtype?: string;
  message?: ClaudeMessage;
  session_id?: string;
  tool_name?: string;
  tool_data?: Record<string, unknown>;
  result?: string;
  is_error?: boolean;
  event?: ClaudeStreamEvent;
  // For content_block_delta streaming
  index?: number;
  delta?: {
    type: 'text_delta' | 'thinking_delta';
    text?: string;
    thinking?: string;
  };
}

export interface ClaudeStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
  };
  content_block?: ClaudeContentBlock;
}

// WebSocket event types
export interface WsAttemptStart {
  taskId: string;
  prompt: string;
}

export interface WsAttemptOutput {
  attemptId: string;
  data: ClaudeOutput;
}

export interface WsAttemptFinished {
  attemptId: string;
  status: AttemptStatus;
  code: number | null;
}

// Kanban column config
export const KANBAN_COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'in_review', title: 'In Review' },
  { id: 'done', title: 'Done' },
  { id: 'cancelled', title: 'Cancelled' },
];

// File browser types
export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  gitStatus?: GitFileStatusCode;
  children?: FileEntry[];
}

// Git status types
export type GitFileStatusCode = 'M' | 'A' | 'D' | 'R' | 'U' | '?';

export interface GitFileStatus {
  path: string;
  status: GitFileStatusCode;
  additions?: number;
  deletions?: number;
}

export interface GitStatus {
  branch: string;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: GitFileStatus[];
  ahead: number;
  behind: number;
}

export interface GitDiff {
  diff: string;
  additions: number;
  deletions: number;
}

// Re-export AttemptFile from db schema
export type { AttemptFile, NewAttemptFile } from '@/lib/db/schema';

// Pending file attachment type (before attempt submission)
export type PendingFileStatus = 'pending' | 'uploading' | 'uploaded' | 'error';

export interface PendingFile {
  tempId: string;
  originalName: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  status: PendingFileStatus;
  error?: string;
  file?: File;
}

// Checkpoint type for conversation rewind
export interface Checkpoint {
  id: string;
  taskId: string;
  attemptId: string;
  sessionId: string;
  messageCount: number;
  summary: string | null;
  createdAt: number;
  attempt?: {
    displayPrompt: string | null;
    prompt: string;
  };
}
