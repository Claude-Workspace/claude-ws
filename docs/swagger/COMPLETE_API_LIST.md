# Claude Workspace API - Complete Documentation

This document provides a complete overview of all **67 API endpoints** across **15 categories** in the Claude Workspace API.

## Quick Stats

- **Total API Endpoints**: 67
- **API Route Files**: 67 route.ts files
- **Categories**: 15
- **Authentication**: API Key (X-API-Key header) for specific endpoints

## API Categories Overview

### 1. Agent Factory (20 endpoints)
Manages agent components (skills, commands, agents) discovery, import, and plugin management.

**Endpoints:**
- `POST /api/agent-factory/compare` - Compare two components
- `GET /api/agent-factory/dependencies` - List component dependencies
- `POST /api/agent-factory/dependencies/{id}/install` - Install a dependency
- `POST /api/agent-factory/discover` - Scan filesystem for components
- `POST /api/agent-factory/file-content` - Get component file content
- `GET /api/agent-factory/files` - List component files
- `POST /api/agent-factory/import` - Import component from filesystem
- `GET /api/agent-factory/plugins` - List all plugins
- `POST /api/agent-factory/plugins` - Create new plugin
- `GET /api/agent-factory/plugins/{id}` - Get plugin details
- `PUT /api/agent-factory/plugins/{id}` - Update plugin
- `DELETE /api/agent-factory/plugins/{id}` - Delete plugin
- `GET /api/agent-factory/plugins/{id}/dependencies` - Get plugin dependencies
- `GET /api/agent-factory/plugins/{id}/files` - List plugin files
- `GET /api/agent-factory/plugins/{id}/files/{...path}` - Get plugin file content
- `POST /api/agent-factory/plugins/{id}/files/save` - Save plugin file
- `GET /api/agent-factory/projects/{projectId}/components` - Get project components
- `GET /api/agent-factory/projects/{projectId}/installed` - Get installed plugins
- `GET /api/agent-factory/projects/{projectId}/plugins` - Get project plugins
- `POST /api/agent-factory/projects/{projectId}/sync` - Sync project components
- `POST /api/agent-factory/projects/{projectId}/uninstall` - Uninstall plugin
- `POST /api/agent-factory/upload` - Upload component file
- `POST /api/agent-factory/upload/cancel` - Cancel upload
- `POST /api/agent-factory/upload/update` - Update upload progress

**Authentication**: All endpoints require `X-API-Key` header

### 2. Attempts (3 endpoints)
Task execution attempt management.

**Endpoints:**
- `GET /api/attempts` - List all attempts (optionally filtered by taskId)
- `POST /api/attempts` - Create new attempt (supports queue and sync modes)
- `GET /api/attempts/{id}` - Get attempt details
- `DELETE /api/attempts/{id}` - Delete attempt
- `GET /api/attempts/{id}/status` - Get lightweight status only

**Special Features:**
- Queue mode: Returns immediately with attempt ID
- Sync mode: Waits for completion and returns formatted output
- Supports output formats: json, html, markdown, yaml, raw, custom
- Auto-creates tasks and projects with `force_create` parameter

### 3. Auth (1 endpoint)
Authentication verification.

**Endpoints:**
- `POST /api/auth/verify` - Verify API key validity

**Authentication**: Requires `X-API-Key` header

### 4. Checkpoints (3 endpoints)
Conversation checkpoint management for rewind functionality.

**Endpoints:**
- `GET /api/checkpoints?taskId=xxx` - List task checkpoints
- `POST /api/checkpoints/backfill` - Create checkpoints for completed attempts
- `POST /api/checkpoints/rewind` - Rewind task to checkpoint state

**Features:**
- Stores conversation state and file checkpoints
- Supports SDK file rewind
- Conversation rewind to specific message UUID

### 5. Code (1 endpoint)
Inline code editing with AI assistance.

**Endpoints:**
- `POST /api/code/inline-edit` - Start inline edit session
- `DELETE /api/code/inline-edit` - Cancel active session

**Features:**
- Real-time streaming via Socket.io
- Context-aware code editing
- Before/after context support

### 6. Commands (2 endpoints)
Claude Code slash command management.

**Endpoints:**
- `GET /api/commands` - List all available commands (built-in + user)
- `GET /api/commands/{name}` - Get command content
- `POST /api/commands/{name}` - Process command with arguments

**Command Types:**
- Built-in commands (bug, clear, help, etc.)
- User commands from `~/.claude/commands/`
- Supports subcommands with `:` separator

### 7. Files (4 endpoints)
File system operations and browsing.

**Endpoints:**
- `GET /api/files` - List directory tree with git status
- `GET /api/files/search` - Search files by name (fuzzy match)
- `GET /api/files/content` - Read file content

**Features:**
- Recursive directory traversal
- Git status integration (M, A, D, R, U, ?)
- Fuzzy search with scoring
- Excludes: node_modules, .git, .next, etc.

### 8. Filesystem (1 endpoint)
Simple directory browsing for project selection.

**Endpoints:**
- `GET /api/filesystem?path=/xxx` - List directories (non-recursive)

**Features:**
- Resolves `~` to home directory
- Shows parent directory
- Toggle hidden directories
- Sorted output

### 9. Git (13 endpoints)
Comprehensive Git repository operations.

**Endpoints:**
- `GET /api/git/status` - Get repository status
- `POST /api/git/diff` - Get git diff
- `POST /api/git/stage` - Stage files
- `DELETE /api/git/stage` - Unstage files
- `POST /api/git/discard` - Discard changes
- `POST /api/git/commit` - Create commit
- `POST /api/git/fetch` - Fetch from remote
- `POST /api/git/pull` - Pull from remote (with rebase)
- `POST /api/git/push` - Push to remote
- `GET /api/git/log` - Get commit history
- `POST /api/git/branch` - Create new branch
- `GET /api/git/branches` - List all branches
- `POST /api/git/checkout` - Checkout branch
- `POST /api/git/generate-message` - Generate commit message
- `GET /api/git/show` - Show commit details
- `POST /api/git/show-file-diff` - Show file-specific diff

**Features:**
- Security: Path traversal protection
- Timeouts: 5-10 seconds for git commands
- Diff statistics (additions/deletions)
- Branch creation from commit
- Merge conflict detection

### 10. Language (1 endpoint)
Language service for code intelligence.

**Endpoints:**
- `GET /api/language/definition` - Check definition support for file type
- `POST /api/language/definition` - Resolve symbol definition (goto-definition)

**Features:**
- Multi-language support via adapters
- Returns file location, line, column
- Provides code preview
- Supports: TypeScript, Python, Go, etc.

### 11. Projects (5 endpoints)
Project management and settings.

**Endpoints:**
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `GET /api/projects/{id}/settings` - Get project settings
- `POST /api/projects/{id}/settings` - Update project settings

**Project Settings:**
- `selectedComponents`: Array of component IDs
- `selectedAgentSets`: Array of agent set IDs
- Stored in `.claude/project-settings.json`

**Authentication**: Settings endpoints require `X-API-Key`

### 12. Search (2 endpoints)
File and content search operations.

**Endpoints:**
- `GET /api/search/files` - Fuzzy search by filename
- `GET /api/search/content` - Grep-like content search

**Content Search Features:**
- Case-sensitive option
- Regex pattern support
- Whole word matching
- Per-file limits
- Context extraction

### 13. Shells (1 endpoint)
Shell command execution management.

**Endpoints:**
- `GET /api/shells` - List active shells

**Features:**
- Track background shell processes
- Cleanup on completion
- Status tracking

### 14. Tasks (7 endpoints)
Task and attempt management.

**Endpoints:**
- `GET /api/tasks` - List tasks (supports filtering)
- `POST /api/tasks` - Create new task
- `GET /api/tasks/{id}` - Get task details
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `GET /api/tasks/{id}/attempts` - List task attempts
- `GET /api/tasks/{id}/conversation` - Get conversation history
- `GET /api/tasks/{id}/running-attempt` - Get running attempt
- `GET /api/tasks/{id}/stats` - Get task statistics
- `PUT /api/tasks/reorder` - Reorder single task
- `POST /api/tasks/reorder` - Batch reorder tasks

**Task Status:** todo, in_progress, in_review, done, cancelled

**Features:**
- Multi-project filtering
- Position-based ordering
- Cascade delete (attempts → logs → checkpoints)

### 15. Uploads (3 endpoints)
File upload management.

**Endpoints:**
- `POST /api/uploads` - Upload files to temp storage
- `GET /api/uploads/{fileId}` - Serve uploaded file
- `DELETE /api/uploads/{fileId}` - Delete temp file

**Features:**
- Max total size: 50MB
- Temp directory: `.claude-ws/temp/`
- File validation (type, size)
- Sanitized filenames
- Nanoid-based unique IDs

## Data Models

### Core Types

```typescript
type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
type AttemptStatus = 'running' | 'completed' | 'failed' | 'cancelled'
type PluginType = 'skill' | 'command' | 'agent' | 'agent_set'
type StorageType = 'local' | 'imported' | 'external'
type OutputFormat = 'json' | 'html' | 'markdown' | 'yaml' | 'raw' | 'custom'
type RequestMethod = 'queue' | 'sync'
```

### Key Schemas

#### Project
```typescript
{
  id: string
  name: string
  path: string
  createdAt: number
  settings?: ProjectSettings
}
```

#### Task
```typescript
{
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  position: number
  chatInit: boolean
  rewindSessionId?: string
  rewindMessageUuid?: string
  createdAt: number
  updatedAt: number
}
```

#### Attempt
```typescript
{
  id: string
  taskId: string
  prompt: string
  status: AttemptStatus
  branch?: string
  diffAdditions: number
  diffDeletions: number
  outputFormat?: OutputFormat
  outputSchema?: string
  createdAt: number
  completedAt?: number
}
```

#### Plugin
```typescript
{
  id: string
  type: PluginType
  name: string
  description?: string
  sourcePath?: string
  agentSetPath?: string
  storageType: StorageType
  metadata?: string
  createdAt: number
  updatedAt: number
}
```

#### Checkpoint
```typescript
{
  id: string
  taskId: string
  attemptId: string
  sessionId: string
  gitCommitHash: string  // SDK checkpoint UUID
  messageCount: number
  summary?: string
  createdAt: number
  attempt?: {
    displayPrompt: string
    prompt: string
  }
}
```

#### GitStatus
```typescript
{
  branch: string
  staged: GitFileStatus[]
  unstaged: GitFileStatus[]
  untracked: GitFileStatus[]
  ahead: number
  behind: number
}
```

## Authentication

### API Key
Header: `X-API-Key: <your-key>`

**Required for:**
- All Agent Factory endpoints
- Project settings endpoints
- Auth verification endpoint

**How to get an API key:**
1. Check project settings
2. Generate via Claude Code CLI
3. Stored in project configuration

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `207` - Multi-Status (partial success)
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (invalid permissions)
- `404` - Not Found
- `408` - Request Timeout (sync mode)
- `409` - Conflict (duplicate, rejected)
- `500` - Internal Server Error
- `503` - Service Unavailable (adapter not available)
- `504` - Gateway Timeout (git command timeout)

## Usage Examples

### Create Task and Run Attempt (Queue Mode)

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "abc123",
    "title": "Fix login bug",
    "description": "Users cannot login with SAML"
  }'

curl -X POST http://localhost:3000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task_abc",
    "prompt": "Investigate the SAML login issue",
    "request_method": "queue"
  }'
```

### Create and Run Attempt (Sync Mode with Output Format)

```bash
curl -X POST http://localhost:3000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task_abc",
    "prompt": "Generate a user model",
    "request_method": "sync",
    "output_format": "json",
    "timeout": 120000
  }'
```

### Force Create Task, Project, and Attempt

```bash
curl -X POST http://localhost:3000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "new_task_id",
    "prompt": "Set up the project",
    "force_create": true,
    "projectId": "new_project_id",
    "projectName": "My New Project",
    "taskTitle": "Initial Setup",
    "projectRootPath": "/Users/me/projects"
  }'
```

### Git Operations

```bash
# Get status
curl "http://localhost:3000/api/git/status?path=/path/to/project"

# Stage files
curl -X POST http://localhost:3000/api/git/stage \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/project",
    "files": ["src/file.ts"]
  }'

# Commit
curl -X POST http://localhost:3000/api/git/commit \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/project",
    "title": "Fix login bug",
    "description": "Added SAML validation"
  }'

# Create branch from commit
curl -X POST http://localhost:3000/api/git/branch \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/project",
    "branchName": "feature/login-fix",
    "startPoint": "abc123def456",
    "checkout": true
  }'
```

### Search Files

```bash
# Fuzzy filename search
curl "http://localhost:3000/api/search/files?q=user&basePath=/path/to/project&limit=20"

# Content search (grep-like)
curl "http://localhost:3000/api/search/content?q=TODO&basePath=/path/to/project&caseSensitive=true&limit=100"
```

### Agent Factory

```bash
# Discover components
curl -X POST http://localhost:3000/api/agent-factory/discover \
  -H "X-API-Key: your-key"

# Create plugin
curl -X POST http://localhost:3000/api/agent-factory/plugins \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "skill",
    "name": "code-review",
    "description": "Review code for best practices"
  }'
```

### Checkpoints and Rewind

```bash
# List checkpoints
curl "http://localhost:3000/api/checkpoints?taskId=task_abc"

# Rewind to checkpoint
curl -X POST http://localhost:3000/api/checkpoints/rewind \
  -H "Content-Type: application/json" \
  -d '{
    "checkpointId": "ckpt_abc",
    "rewindFiles": true
  }'
```

## WebSocket/Socket.io

Real-time communication for attempt execution is handled via Socket.io, not REST.

**Events:**
- `attempt:started` - Attempt execution started
- `attempt:output` - Real-time output stream
- `attempt:completed` - Attempt finished
- `attempt:error` - Execution error

## Rate Limiting

No explicit rate limiting is implemented, but:
- Git commands have internal timeouts (5-10s)
- Sync mode attempts timeout at 5 minutes default
- File uploads limited to 50MB total

## CORS

API supports CORS for cross-origin requests. Configure via Next.js middleware if needed.

## Documentation Files

- `swagger.yaml` - OpenAPI 3.0 specification (main)
- `api-docs.html` - Interactive Swagger UI viewer
- `API_DOCUMENTATION.md` - This guide
- `COMPLETE_API_LIST.md` - Comprehensive endpoint list

## Testing

### Using Swagger UI

1. Start dev server: `npm run dev`
2. Open `api-docs.html` in browser
3. Interactive API testing interface

### Using cURL

See examples above.

### Using Postman/Insomnia

1. Import `swagger.yaml`
2. Set base URL
3. Configure API key in headers
4. Test endpoints

## Development

### Adding New Endpoints

1. Create route file: `src/app/api/category/endpoint-name/route.ts`
2. Export GET/POST/PUT/DELETE handlers
3. Update `swagger.yaml` with endpoint documentation
4. Test using Swagger UI

### Database Schema

See `src/lib/db/schema.ts` for table definitions:
- `projects`
- `tasks`
- `attempts`
- `attempt_logs`
- `checkpoints`
- `agent_factory_plugins`

## Support

- Issues: https://github.com/Claude-Workspace/claude-ws/issues
- Documentation: https://github.com/Claude-Workspace/claude-ws/blob/main/docs/API.md
