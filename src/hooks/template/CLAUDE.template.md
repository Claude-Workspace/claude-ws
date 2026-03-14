# Project Context

## Working Directory
All file operations happen in the **root directory** (`./`) of this project. Always use relative paths (e.g. `markdown/file.md`).

## File Operations
- **Read/List:** `view` tool with relative path
- **Create:** `create_file` tool with relative path
- **Edit:** `str_replace` tool with relative path
- **Delete:** `bash_tool` → `rm ./path/to/file` (confirm with user first)

Protected — never modify: `.claude/`, `tmp/`, `node_modules/`, `.git`

## Sync & Storage
Files in `./` are auto-synced with remote storage via `.claude/hooks/`. API endpoint and project ID are pre-configured in `.claude/hooks/.env` — do not modify.

## Skills
Before starting any task, check for relevant skill files:
- **Global skills:** `~/.claude/skills` (docx, pdf, pptx, xlsx, frontend-design, etc.)
- **Local project skills:** `./.claude/skills`
