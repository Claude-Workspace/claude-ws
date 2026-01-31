// Task status types for Kanban board
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';

// Attempt status types
export type AttemptStatus = 'running' | 'completed' | 'failed' | 'cancelled';

// Output format types for API responses
export type OutputFormat = 'json' | 'html' | 'markdown' | 'yaml' | 'raw' | 'custom';

// Request method types for attempt execution
export type RequestMethod = 'sync' | 'queue';

// Formatted response interface
export interface FormattedResponse {
  formatted_data: string;
  format: OutputFormat;
  attempt: {
    id: string;
    taskId: string;
    prompt: string;
    status: AttemptStatus;
    createdAt: number;
    completedAt: number | null;
  };
}

// Project settings
export interface ProjectSettings {
  selectedComponents: string[]; // Component IDs
  selectedAgentSets: string[]; // Agent set IDs
}

// Project type
export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  settings?: ProjectSettings;
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
  lastModel: string | null;  // Last used model for this task
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
export const KANBAN_COLUMNS: { id: TaskStatus; titleKey: string }[] = [
  { id: 'todo', titleKey: 'todo' },
  { id: 'in_progress', titleKey: 'inProgress' },
  { id: 'in_review', titleKey: 'inReview' },
  { id: 'done', titleKey: 'done' },
  { id: 'cancelled', titleKey: 'cancelled' },
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

// Git commit details types
export interface CommitFile {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C'; // Added, Modified, Deleted, Renamed, Copied
  additions: number;
  deletions: number;
  oldPath?: string; // For renames
}

export interface CommitDetails {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: string;        // ISO format
  dateRelative: string; // "2 days ago"
  subject: string;     // First line
  body: string;        // Remaining lines (may be empty)
  files: CommitFile[];
  stats: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}
