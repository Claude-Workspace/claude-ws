# Claude Kanban API Reference

Complete API documentation for the Claude Kanban application including Projects, Tasks, Attempts, Checkpoints, Git operations, Files, Search, Uploads, Authentication, Commands, Language, Shells, and Agent Factory.

> **Note:** The default server port is **33333** (not 3000). Set `API_BASE` environment variable to override.

## Base URL

```
/api
```

## Authentication

All API requests require authentication via API key in the `x-api-key` header when `API_ACCESS_KEY` environment variable is set:

```http
x-api-key: your-api-key-here
```

### Check Auth Status

```http
GET /api/auth/verify
```

**Response:**
```json
{
  "authRequired": true
}
```

### Verify API Key

```http
POST /api/auth/verify
```

**Request Body:**
```json
{
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "valid": true,
  "authRequired": true
}
```

---

## Projects

Manage projects in the Kanban system.

### List All Projects

```http
GET /api/projects
```

**Response:**
```json
[
  {
    "id": "proj-abc123",
    "name": "My Project",
    "path": "/path/to/project",
    "createdAt": 1700000000000
  }
]
```

### Get Project by ID

```http
GET /api/projects/{id}
```

**Response:** Single project object

### Create Project

```http
POST /api/projects
```

**Request Body:**
```json
{
  "name": "New Project",
  "path": "/path/to/new/project"
}
```

**Response:** Created project object (201)

**Error Responses:**
- `400` - Missing required fields
- `409` - Project with this path already exists

### Update Project

```http
PUT /api/projects/{id}
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "path": "/new/path"
}
```

**Response:** Updated project object

### Delete Project

```http
DELETE /api/projects/{id}
```

**Response:**
```json
{
  "success": true
}
```

### Get Project Settings

```http
GET /api/projects/{id}/settings
```

**Response:**
```json
{
  "settings": {
    "selectedPlugins": ["plugin-1", "plugin-2"],
    "selectedAgentSets": ["agent-set-1"]
  }
}
```

### Update Project Settings

```http
POST /api/projects/{id}/settings
```

**Request Body:**
```json
{
  "settings": {
    "selectedPlugins": ["plugin-1", "plugin-2"],
    "selectedAgentSets": ["agent-set-1"]
  }
}
```

---

## Tasks

Manage tasks within projects.

### List Tasks

```http
GET /api/tasks?projectId={id}
GET /api/tasks?projectIds={id1,id2,id3}
GET /api/tasks
```

**Query Parameters:**
- `projectId` (optional): Filter by single project
- `projectIds` (optional): Filter by multiple projects (comma-separated)
- No parameters: Returns all tasks

**Response:**
```json
[
  {
    "id": "task-abc123",
    "projectId": "proj-abc123",
    "title": "Build feature",
    "description": "Implement the feature",
    "status": "in_progress",
    "position": 0,
    "chatInit": 1,
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000
  }
]
```

**Task Status Values:** `todo`, `in_progress`, `in_review`, `done`, `cancelled`

### Get Task by ID

```http
GET /api/tasks/{id}
```

**Response:** Single task object

### Create Task

```http
POST /api/tasks
```

**Request Body:**
```json
{
  "projectId": "proj-abc123",
  "title": "New Task",
  "description": "Task description",
  "status": "todo"
}
```

**Response:** Created task object (201)

**Note:** If a task with the same title already exists in the project, its description will be updated instead.

### Update Task

```http
PUT /api/tasks/{id}
PATCH /api/tasks/{id}
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "in_progress",
  "position": 1,
  "chatInit": true
}
```

**Response:** Updated task object

### Delete Task

```http
DELETE /api/tasks/{id}
```

**Response:**
```json
{
  "success": true
}
```

### Reorder Tasks

```http
PUT /api/tasks/reorder
```

Reorder a single task.

**Request Body:**
```json
{
  "taskId": "task-abc123",
  "status": "in_progress",
  "position": 2
}
```

### Batch Reorder Tasks

```http
POST /api/tasks/reorder
```

Reorder multiple tasks at once.

**Request Body:**
```json
{
  "tasks": [
    {
      "id": "task-1",
      "status": "todo",
      "position": 0
    },
    {
      "id": "task-2",
      "status": "todo",
      "position": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "updated": 2
}
```

### Get Task Conversation

```http
GET /api/tasks/{id}/conversation
```

Get the conversation history for a task.

**Response:**
```json
{
  "turns": [
    {
      "type": "user",
      "prompt": "User's message",
      "messages": [],
      "attemptId": "attempt-1",
      "timestamp": 1700000000000,
      "files": [
        {
          "id": "file-1",
          "filename": "upload.txt",
          "originalName": "file.txt",
          "mimeType": "text/plain",
          "size": 1024
        }
      ]
    },
    {
      "type": "assistant",
      "messages": [
        {
          "type": "assistant",
          "message": {
            "content": [
              {
                "type": "text",
                "text": "Response text"
              }
            ]
          }
        }
      ],
      "attemptId": "attempt-1",
      "timestamp": 1700000000000
    }
  ]
}
```

### Get Task Attempts

```http
GET /api/tasks/{id}/attempts
```

Get all attempts for a task.

**Response:**
```json
[
  {
    "id": "attempt-1",
    "taskId": "task-1",
    "sessionId": "session-1",
    "prompt": "User prompt",
    "displayPrompt": "Display prompt",
    "status": "completed",
    "createdAt": 1700000000000,
    "completedAt": 1700000100000
  }
]
```

### Get Running Attempt

```http
GET /api/tasks/{id}/running-attempt
```

Get the currently running attempt for a task.

**Response:**
```json
{
  "id": "attempt-1",
  "status": "running"
}
```

---

## Attempts

An **Attempt** represents a single conversation turn - essentially a user message (prompt) and Claude's response.

Each time you send a message to Claude, a new attempt is created. The attempt contains:
- The user's prompt
- The full conversation history (messages streaming in real-time)
- The session ID for conversation continuity
- The result status when completed

### Attempt Lifecycle

```
User sends message → Create attempt → Stream messages → Complete → Create checkpoint
                         ↓
                    Running status
                         ↓
         ┌───────────────┴───────────────┐
         ↓                               ↓
    Completed/Failed                 Cancelled
         ↓
    Checkpoint created
```

### Get Attempt by ID

```http
GET /api/attempts/{id}
```

**Response:**
```json
{
  "id": "attempt-1",
  "taskId": "task-1",
  "sessionId": "session-1",
  "prompt": "User prompt",
  "displayPrompt": "Display prompt",
  "status": "completed",
  "createdAt": 1700000000000,
  "completedAt": 1700000100000,
  "logs": [
    {
      "id": "log-1",
      "type": "json",
      "content": "{\"type\":\"user\",...}",
      "createdAt": 1700000000000
    }
  ]
}
```

### Get Attempt Status

```http
GET /api/attempts/{id}/status
```

**Response:**
```json
{
  "status": "running"
}
```

**Status Values:** `pending`, `running`, `completed`, `failed`, `cancelled`

---

## Checkpoints

Manage conversation checkpoints for tasks.

### List Checkpoints

```http
GET /api/checkpoints?taskId={id}
```

**Response:**
```json
[
  {
    "id": "checkpoint-1",
    "taskId": "task-1",
    "attemptId": "attempt-1",
    "sessionId": "session-1",
    "gitCommitHash": "abc123",
    "messageCount": 10,
    "summary": "Brief summary of conversation...",
    "createdAt": 1700000000000,
    "attempt": {
      "displayPrompt": "Display prompt",
      "prompt": "Original prompt"
    }
  }
]
```

### Backfill Checkpoints

```http
POST /api/checkpoints/backfill
```

Creates checkpoints for existing completed attempts that don't have one.

**Response:**
```json
{
  "success": true,
  "created": 5,
  "skipped": 2,
  "total": 7
}
```

### Rewind to Checkpoint

```http
POST /api/checkpoints/rewind
```

Restore conversation state from a checkpoint.

**Request Body:**
```json
{
  "checkpointId": "checkpoint-1"
}
```

---

## Git Operations

Manage git repositories for projects.

### Get Git Status

```http
GET /api/git/status?path=/project/path
```

**Response:**
```json
{
  "branch": "main",
  "staged": [
    {
      "path": "src/file.ts",
      "status": "M",
      "additions": 5,
      "deletions": 2
    }
  ],
  "unstaged": [
    {
      "path": "src/other.ts",
      "status": "M",
      "additions": 1,
      "deletions": 0
    }
  ],
  "untracked": [
    {
      "path": "newfile.txt",
      "status": "?"
    }
  ],
  "ahead": 2,
  "behind": 0
}
```

**File Status Codes:** `M` (Modified), `A` (Added), `D` (Deleted), `R` (Renamed), `U` (Unmerged), `?` (Untracked)

### Get Git Diff

```http
GET /api/git/diff?path=/project/path&file=src/file.ts&staged=true
```

**Query Parameters:**
- `path` (required): Project path
- `file` (optional): Specific file to diff
- `staged` (optional): Get staged diff (default: false)

**Response:**
```json
{
  "diff": "diff --git a/src/file.ts b/src/file.ts\n...",
  "additions": 10,
  "deletions": 5
}
```

### Get Git Log

```http
GET /api/git/log?path=/project/path&limit=50
```

**Response:**
```json
{
  "commits": [
    {
      "hash": "abc123def456...",
      "shortHash": "abc123d",
      "message": "Commit message",
      "author": "John Doe",
      "date": "2 days ago",
      "parents": ["parent_hash"],
      "refs": ["HEAD -> main", "origin/main"]
    }
  ],
  "head": "abc123def456..."
}
```

### Stage Files

```http
POST /api/git/stage
```

**Request Body:**
```json
{
  "projectPath": "/path/to/project",
  "files": ["src/file.ts", "src/other.ts"],
  "all": false
}
```

Use `files` array for specific files or `all: true` to stage all changes.

**Response:**
```json
{
  "success": true
}
```

### Unstage Files

```http
DELETE /api/git/stage
```

**Request Body:** Same as stage

### Commit Changes

```http
POST /api/git/commit
```

**Request Body:**
```json
{
  "projectPath": "/path/to/project",
  "message": "Commit message"
}
```

**Response:**
```json
{
  "success": true,
  "hash": "abc123d",
  "message": "Commit message"
}
```

**Error Responses:**
- `400` - Nothing to commit

### Discard Changes

```http
POST /api/git/discard
```

**Request Body:**
```json
{
  "projectPath": "/path/to/project",
  "files": ["src/file.ts"],
  "all": false
}
```

Use `files` array for specific files or `all: true` to discard all changes.

**Response:**
```json
{
  "success": true
}
```

### Pull from Remote

```http
POST /api/git/pull
```

**Request Body:**
```json
{
  "projectPath": "/path/to/project"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pull successful"
}
```

**Error Responses:**
- `409` - Merge conflict detected
- `400` - No upstream branch configured

### Push to Remote

```http
POST /api/git/push
```

**Request Body:** Same as pull

**Response:**
```json
{
  "success": true,
  "message": "Push successful"
}
```

**Error Responses:**
- `409` - Push rejected (pull first)
- `400` - No upstream branch

### Fetch from Remote

```http
POST /api/git/fetch
```

**Request Body:** Same as pull

---

## Files & Filesystem

Browse and read files in projects.

### List Files (Project Tree)

```http
GET /api/files?path=/project/path&depth=10&showHidden=false
```

**Query Parameters:**
- `path` (required): Project directory path
- `depth` (optional): Maximum depth (default: 10)
- `showHidden` (optional): Show hidden files (default: false)

**Response:**
```json
{
  "entries": [
    {
      "name": "src",
      "path": "src",
      "type": "directory",
      "children": [
        {
          "name": "file.ts",
          "path": "src/file.ts",
          "type": "file",
          "gitStatus": "M"
        }
      ]
    }
  ],
  "basePath": "/path/to/project"
}
```

**Excluded Directories:** `node_modules`, `.git`, `.next`, `dist`, `build`, `.turbo`

### Get File Content

```http
POST /api/files/content
```

**Request Body:**
```json
{
  "path": "/path/to/file.md"
}
```

**Response:**
```json
{
  "content": "file content here..."
}
```

### List Filesystem Directories

```http
GET /api/filesystem?path=/some/path&showHidden=false
```

Browse any directory on the filesystem (for project selection).

**Response:**
```json
{
  "currentPath": "/home/user/projects",
  "parentPath": "/home/user",
  "directories": [
    {
      "name": "project1",
      "path": "/home/user/projects/project1",
      "isDirectory": true
    }
  ],
  "homePath": "/home/user"
}
```

Supports `~` expansion for home directory.

---

## Search

Search for files and content.

### Search Files (Fuzzy)

```http
GET /api/search/files?q=filename&basePath=/project/path&limit=50
```

**Query Parameters:**
- `q` (optional): Search query (returns all if empty)
- `basePath` (required): Project root path
- `limit` (optional): Max results (default: 50)

**Response:**
```json
{
  "results": [
    {
      "name": "file.ts",
      "path": "src/components/file.ts",
      "type": "file",
      "score": 0.95,
      "matches": [0, 4, 8]
    }
  ],
  "total": 42
}
```

### Search Content

```http
POST /api/search/content
```

**Request Body:**
```json
{
  "query": "search term",
  "basePath": "/path/to/project",
  "limit": 50
}
```

---

## Uploads

Upload files for task attachments.

### Upload Files

```http
POST /api/uploads
```

Content-Type: `multipart/form-data`

**Form Data:**
- `files`: File(s) to upload (array)

**Response:**
```json
{
  "files": [
    {
      "tempId": "temp-abc123",
      "filename": "1700000000000-upload.txt",
      "originalName": "upload.txt",
      "mimeType": "text/plain",
      "size": 1024
    }
  ]
}
```

**Constraints:**
- Max total size: 50MB
- Max individual file: 10MB
- Excludes: `.exe`, `.dll`, `.so`, `.dylib`, `.sh`

### Get Upload by ID

```http
GET /api/uploads/{fileId}
```

---

## Commands

Manage Claude slash commands.

### List Commands

```http
GET /api/commands
```

**Response:**
```json
[
  {
    "name": "commit",
    "description": "Create git commit",
    "argumentHint": "[commit message]"
  }
]
```

### Get Command

```http
GET /api/commands/{name}?subcommand={subcommand}
```

**Response:**
```json
{
  "name": "commit:amend",
  "description": "Amend last commit",
  "argumentHint": "[new message]",
  "body": "Command prompt content..."
}
```

### Process Command

```http
POST /api/commands/{name}
```

**Request Body:**
```json
{
  "arguments": "arg value",
  "subcommand": "subcommand-name"
}
```

**Response:**
```json
{
  "name": "commit",
  "prompt": "Processed command prompt with arguments..."
}
```

Commands are stored in `~/.claude/commands/{name}.md`

---

## Language

Get language definitions for code blocks.

### Get Language Definition

```http
GET /api/language/definition?language=typescript
```

**Response:**
```json
{
  "language": "typescript",
  "extensions": [".ts", ".tsx"],
  "aliases": ["ts", "tsx"]
}
```

---

## Shells

Track shell processes created during task execution.

### List Shells

```http
GET /api/shells?projectId={id}
```

**Response:**
```json
[
  {
    "shellId": "shell-1",
    "projectId": "proj-1",
    "attemptId": "attempt-1",
    "command": "npm install",
    "pid": 12345,
    "startedAt": 1700000000000,
    "isRunning": true,
    "exitCode": null
  }
]
```

---

## Agent Factory

Manage plugins (skills, commands, agents, agent sets).

### List All Plugins

```http
GET /api/agent-factory/plugins?type={type}
```

**Query Parameters:**
- `type` (optional): Filter by plugin type - `skill`, `command`, `agent`, or `agent_set`

**Response:**
```json
{
  "plugins": [
    {
      "id": "plugin-abc123",
      "type": "skill",
      "name": "My Skill",
      "description": "Does something useful",
      "sourcePath": "/path/to/skill",
      "storageType": "local",
      "agentSetPath": null,
      "metadata": null,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ]
}
```

### Get Plugin by ID

```http
GET /api/agent-factory/plugins/{id}
```

**Response:** Single plugin object

### Create Plugin

```http
POST /api/agent-factory/plugins
```

**Request Body:**
```json
{
  "type": "skill",
  "name": "My Skill",
  "description": "Does something useful",
  "storageType": "local"
}
```

### Update Plugin

```http
PUT /api/agent-factory/plugins/{id}
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### Delete Plugin

```http
DELETE /api/agent-factory/plugins/{id}
```

### List Plugin Files

```http
GET /api/agent-factory/plugins/{id}/files
```

**Response:**
```json
{
  "type": "skill",
  "name": "My Skill",
  "path": "/path/to/skill",
  "isDirectory": true,
  "children": [
    {
      "name": "SKILL.md",
      "path": "/path/to/skill/SKILL.md",
      "type": "file",
      "size": 1024
    }
  ]
}
```

### Get Plugin File Content

```http
GET /api/agent-factory/plugins/{id}/files/{...path}
```

### Save Plugin File

```http
POST /api/agent-factory/plugins/{id}/files/save
```

**Request Body:**
```json
{
  "path": "SKILL.md",
  "content": "# My Skill\n..."
}
```

### Get Plugin Dependencies

```http
GET /api/agent-factory/plugins/{id}/dependencies
```

**Response:**
```json
{
  "dependencies": [
    {
      "id": "dep-123",
      "componentId": "plugin-abc123",
      "dependencyType": "python",
      "spec": "requests>=2.0.0",
      "installed": false
    }
  ],
  "resolved": {
    "libraries": [
      {
        "manager": "python",
        "name": "requests",
        "spec": ">=2.0.0",
        "installed": false
      }
    ],
    "components": [],
    "hasInstallScript": true,
    "installScripts": {
      "pip": "pip install requests"
    }
  }
}
```

### Install Dependency

```http
POST /api/agent-factory/dependencies/{id}/install
```

### Discover Plugins

```http
POST /api/agent-factory/discover
```

**Request Body:**
```json
{
  "paths": [
    "/path/to/skills",
    "/path/to/commands"
  ]
}
```

### Compare with Existing

```http
POST /api/agent-factory/compare
```

**Request Body:**
```json
{
  "discovered": [
    {
      "type": "skill",
      "name": "My Skill",
      "sourcePath": "/path/to/skill",
      "metadata": {}
    }
  ]
}
```

**Response:**
```json
{
  "plugins": [
    {
      "type": "skill",
      "name": "My Skill",
      "sourcePath": "/path/to/skill",
      "status": "new",
      "metadata": {}
    }
  ]
}
```

**Status Values:** `new`, `update`, `current`

### Import Plugin

```http
POST /api/agent-factory/import
```

**Request Body:**
```json
{
  "type": "skill",
  "name": "My Skill",
  "sourcePath": "/path/to/skill",
  "storageType": "imported"
}
```

### Upload Plugin

```http
POST /api/agent-factory/upload
```

Content-Type: `multipart/form-data`

### Get Installed Plugins

```http
GET /api/agent-factory/projects/{projectId}/installed
```

**Response:**
```json
{
  "installed": ["plugin-1", "plugin-2"]
}
```

### Install Plugins to Project

```http
POST /api/agent-factory/projects/{projectId}/sync
```

**Response:**
```json
{
  "success": true,
  "message": "Installed 3 components to project",
  "installed": [
    "skill: My Skill",
    "command: my-command"
  ],
  "skipped": [
    "skill: Already Installed: Existing Skill"
  ],
  "errors": []
}
```

### Uninstall Plugin from Project

```http
POST /api/agent-factory/projects/{projectId}/uninstall
```

**Request Body:**
```json
{
  "componentId": "plugin-abc123"
}
```

### Get File Content

```http
POST /api/agent-factory/file-content
```

**Request Body:**
```json
{
  "path": "/path/to/file.md"
}
```

---

## Plugin Types Reference

| Type | Description | Storage Location |
|------|-------------|-------------------|
| `skill` | Reusable skill with SKILL.md | `.claude/agent-factory/skills/{name}/` |
| `command` | Slash command | `.claude/agent-factory/commands/{name}.md` |
| `agent` | AI agent configuration | `.claude/agent-factory/agents/{name}.md` |
| `agent_set` | Collection of plugins | Custom path with subdirectories |

## Storage Types Reference

| Type | Description |
|------|-------------|
| `local` | Created and managed locally |
| `imported` | Imported from external source |
| `external` | External reference (no local copy) |

## Error Responses

All endpoints may return error responses:

```json
{
  "error": "Error message"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `207` | Multi-Status (partial success) |
| `400` | Bad Request (invalid parameters) |
| `401` | Unauthorized (missing/invalid API key) |
| `403` | Forbidden (path escape attempt) |
| `404` | Not Found (resource doesn't exist) |
| `409` | Conflict (duplicate resource) |
| `500` | Internal Server Error |
| `504` | Gateway Timeout (git command timeout) |

---

## WebSocket Streaming & Interactions

Claude Kanban uses Socket.io for real-time streaming of Claude Agent responses and handling user interactions.

### Connection

Connect to the WebSocket server at the same host as the HTTP server:

```javascript
import { io } from 'socket.io-client';

const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
});
```

### Socket Events

#### Client → Server Events

##### Start Attempt

```javascript
socket.emit('attempt:start', {
  taskId: 'task-abc123',
  prompt: 'Build a feature',
  displayPrompt: 'Build a user authentication feature',
  fileIds: ['temp-file-1', 'temp-file-2']  // Optional file attachments
});
```

**Response:** `attempt:started` event

##### Cancel Attempt

```javascript
socket.emit('attempt:cancel', {
  attemptId: 'attempt-abc123'
});
```

##### Subscribe to Attempt

```javascript
socket.emit('attempt:subscribe', {
  attemptId: 'attempt-abc123'
});
```

##### Answer Question (AskUserQuestion)

```javascript
socket.emit('question:answer', {
  attemptId: 'attempt-abc123',
  answer: 'option-1'  // Or '\x1b' to cancel (ESC key)
});
```

##### Subscribe to Inline Edit

```javascript
socket.emit('inline-edit:subscribe', {
  sessionId: 'edit-session-123'
}, (ack) => {
  // Acknowledgment when subscribed
  console.log('Subscribed:', ack);
});
```

##### Start Inline Edit

```javascript
socket.emit('inline-edit:start', {
  sessionId: 'edit-session-123',
  basePath: '/path/to/project',
  filePath: 'src/components/Button.tsx',
  language: 'typescript',
  selectedCode: 'const foo = "bar";',
  instruction: 'Rename foo to bar'
}, (result) => {
  if (result.success) {
    console.log('Edit started');
  } else {
    console.error('Error:', result.error);
  }
});
```

##### Cancel Inline Edit

```javascript
socket.emit('inline-edit:cancel', {
  sessionId: 'edit-session-123'
});
```

##### Subscribe to Shell Events

```javascript
socket.emit('shell:subscribe', {
  projectId: 'proj-abc123'
});
```

##### Stop Shell

```javascript
socket.emit('shell:stop', {
  shellId: 'shell-abc123'
}, (result) => {
  console.log('Shell stopped:', result.success);
});
```

##### Get Shell Logs

```javascript
socket.emit('shell:getLogs', {
  shellId: 'shell-abc123',
  lines: 100
}, (result) => {
  console.log('Logs:', result.logs);
});
```

#### Server → Client Events

##### Attempt Started

```javascript
socket.on('attempt:started', (data) => {
  console.log('Attempt started:', data.attemptId, data.taskId);
});
```

##### Output JSON (Streaming Messages)

```javascript
socket.on('output:json', (data) => {
  const { attemptId, data: output } = data;
  // output.type: 'system' | 'assistant' | 'user' | 'tool_use' | 'tool_result' | 'content_block_delta' | 'result'
  console.log('Message type:', output.type);
});
```

**Message Types:**

| Type | Description |
|------|-------------|
| `system` | System initialization, contains `session_id` |
| `assistant` | Assistant response with content blocks |
| `user` | User message (replay from checkpoint) |
| `tool_use` | Tool invocation with id, name, input |
| `tool_result` | Tool execution result |
| `content_block_delta` | Streaming text/thinking delta |
| `result` | Final result with cost, duration, etc. |

##### Content Block Delta (Streaming)

For real-time streaming of text and thinking:

```javascript
socket.on('output:json', (data) => {
  if (data.data.type === 'content_block_delta') {
    const { delta } = data.data;

    if (delta.type === 'text_delta' && delta.text) {
      // Accumulate text delta
      currentText += delta.text;
    }

    if (delta.type === 'thinking_delta' && delta.thinking) {
      // Accumulate thinking delta
      currentThinking += delta.thinking;
    }
  }
});
```

##### Attempt Finished

```javascript
socket.on('attempt:finished', (data) => {
  console.log('Attempt finished:', data.attemptId, data.status, data.code);
});
```

**Status Values:** `running`, `completed`, `failed`, `cancelled`

##### Task Started/Finished (Global)

```javascript
socket.on('task:started', (data) => {
  console.log('Task started:', data.taskId);
});

socket.on('task:finished', (data) => {
  console.log('Task finished:', data.taskId, data.status);
});
```

##### Question Asked (AskUserQuestion)

```javascript
socket.on('question:ask', (data) => {
  const { attemptId, toolUseId, questions } = data;

  // questions is array of:
  // {
  //   question: string,
  //   header: string,
  //   options: [{ label, description }][]  // 2-4 options
  //   multiSelect: boolean
  // }

  // Display UI to collect user answer
});
```

##### Error

```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
});
```

##### Inline Edit Delta

```javascript
socket.on('inline-edit:delta', (data) => {
  const { sessionId, chunk } = data;
  // Streaming response chunk
});
```

##### Inline Edit Complete

```javascript
socket.on('inline-edit:complete', (data) => {
  const { sessionId, code, diff } = data;
  // Final edited code and unified diff
});
```

##### Inline Edit Error

```javascript
socket.on('inline-edit:error', (data) => {
  const { sessionId, error } = data;
  console.error('Inline edit error:', error);
});
```

##### Shell Events

```javascript
// Shell started
socket.on('shell:started', (data) => {
  const { shellId, projectId, pid, command } = data;
});

// Shell output
socket.on('shell:output', (data) => {
  const { shellId, projectId, type, content } = data;
  // type: 'stdout' | 'stderr'
});

// Shell exited
socket.on('shell:exit', (data) => {
  const { shellId, projectId, code, signal } = data;
});
```

### Message Flow Diagram

```
Client                    Server                    Agent Manager
  |                         |                            |
  |--- attempt:start ------>|                            |
  |                         |--- start() -------------->|
  |                         |                            |
  |<-- attempt:started ----|                            |
  |                         |                            |
  |<-- output:json --------<-------- SDK stream ---------|
  |    (system, session_id)|                            |
  |<-- output:json --------<-------- SDK stream ---------|
  |    (assistant message) |                            |
  |<-- output:json --------<-------- SDK stream ---------|
  |    (content_block_delta, text_delta) -- streaming text
  |<-- output:json --------<-------- SDK stream ---------|
  |    (tool_use)          |                            |
  |<-- output:json --------<-------- SDK stream ---------|
  |    (tool_result)       |                            |
  |                         |                            |
  |<-- question:ask ------| (AskUserQuestion detected)  |
  |--- question:answer --->|                            |
  |                         |--- start() with resume --->|
  |                         |                            |
  |<-- attempt:finished ---<--------- exit --------------|
```

### Streaming Text Handling

The SDK streams text content in chunks for real-time display:

1. **Complete messages** arrive as `type: 'assistant'` with full content
2. **Streaming deltas** arrive as `type: 'content_block_delta'` with `delta.type: 'text_delta'`
3. Accumulate deltas into the last assistant message's text block
4. Complete messages override accumulated deltas (keep longer content)

**Frontend handling pattern:**

```typescript
// Track streaming messages by _attemptId and _fromStreaming flag
setMessages(prev => {
  // Handle content_block_delta - accumulate into existing streaming message
  if (output.type === 'content_block_delta') {
    const existingIndex = prev.findLastIndex(
      m => m.type === 'assistant' && m._attemptId === attemptId && m._fromStreaming
    );
    if (existingIndex >= 0) {
      // Update existing message with new delta
      return [...prev.slice(0, existingIndex), updatedMsg, ...prev.slice(existingIndex + 1)];
    }
  }

  // Handle complete assistant message - merge if last message is streaming
  if (output.type === 'assistant') {
    const lastMsg = prev[prev.length - 1];
    if (lastMsg?._fromStreaming) {
      // Merge content blocks, keep longer text/thinking
      return mergeMessages(prev, output);
    }
  }

  // Default: append new message
  return [...prev, output];
});
```

### Session Management

The system uses Claude Agent SDK's session management for conversation continuity:

- **Session ID**: Returned in `system` message with `subtype: 'init'`
- **Resume**: Pass `resume: <sessionId>` to continue conversation
- **Rewind**: Pass `resumeSessionAt: <messageUuid>` to rewind to checkpoint

Sessions are automatically saved per attempt and can be resumed across page reloads.

### Background Shell Detection

Background shells are detected from two sources:

1. **Markdown code block** (primary):
   ```
   ```background-shell
   npm run dev
   ```
   ```

2. **Bash tool with `run_in_background: true`** (fallback/deprecated):
   ```json
   {
     "type": "tool_use",
     "name": "Bash",
     "input": {
       "command": "npm run dev",
       "run_in_background": true
     }
   }
   ```

Detected shells are spawned via ShellManager and tracked in the database.

---

## Interactive Command Flows

Claude Kanban supports interactive slash commands that prompt users for input through modal dialogs.

### /rewind Command

Restores conversation to a previous checkpoint.

**Flow:**
1. User types `/rewind` in chat input
2. System displays checkpoint selection modal
3. User selects checkpoint via keyboard (↑↓) or click
4. User confirms with Enter or double-click
5. System rewinds conversation and files

**API Endpoint:**
```http
POST /api/checkpoints/rewind
```

**Request Body:**
```json
{
  "checkpointId": "checkpoint-abc123",
  "rewindFiles": true
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-xyz",
  "messageUuid": "user-message-uuid",
  "taskId": "task-123",
  "attemptId": "attempt-456",
  "sdkRewind": { "success": true },
  "conversationRewound": true
}
```

**What Rewind Does:**
- Deletes all attempts/logs/checkpoints after selected checkpoint
- Restores files using SDK `rewindFiles()` if checkpoint UUID exists
- Sets rewind state so next attempt resumes at checkpoint message

**Checkpoint Data Structure:**
```typescript
interface Checkpoint {
  id: string;
  taskId: string;
  attemptId: string;
  sessionId: string;      // SDK session ID
  gitCommitHash: string;  // Stores SDK checkpoint UUID
  messageCount: number;
  summary: string;
  createdAt: number;
  attempt: {
    displayPrompt: string;
    prompt: string;
  };
}
```

### AskUserQuestion Tool

Claude can request user input during conversation using the `AskUserQuestion` tool.

**Flow:**
1. Claude emits `tool_use` with `name: "AskUserQuestion"`
2. Server detects and emits `question:ask` via WebSocket
3. Frontend displays question prompt modal
4. User selects option or types custom answer
5. Answer sent via `question:answer` WebSocket event
6. New attempt started with answer as prompt, resuming session

**Question Format:**
```typescript
interface Question {
  question: string;    // The question text
  header: string;      // Short category/header
  options: Array<{
    label: string;       // Option text
    description: string; // Additional detail
  }>;
  multiSelect: boolean; // Allow multiple selections
}
```

**Question Answer Flow:**

```javascript
// Server emits question
socket.on('question:ask', (data) => {
  const { attemptId, toolUseId, questions } = data;
  // Display modal with questions
});

// User answers
socket.emit('question:answer', {
  attemptId: 'attempt-123',
  answer: 'option-1'  // Or '\x1b' for cancel (ESC)
});
```

**Keyboard Navigation:**
- `↑/↓` - Navigate options
- `Enter` - Select option (or submit for multi-select)
- `Space` - Toggle selection (multi-select)
- `1-9` - Quick select option
- `Esc` - Cancel
- Last option "Type something..." - Enter typing mode for custom input

### Other Interactive Commands

| Command | Description |
|---------|-------------|
| `/model` | Select AI model for conversation |
| `/config` | Edit configuration settings |
| `/clear` | Clear all messages in conversation |
| `/compact` | Compress conversation history to save context |

### Interactive Command State

```typescript
type InteractiveCommandType = 'rewind' | 'model' | 'config' | 'clear' | 'compact';

interface InteractiveCommandState {
  activeCommand: InteractiveCommand | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
}
```

**Store Actions:**
- `openCommand(command)` - Open modal with command
- `closeCommand()` - Close modal
- `setLoading(loading)` - Set loading state
- `setError(error)` - Set error message
- `reset()` - Reset to initial state
