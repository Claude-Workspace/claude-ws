# Project Commands & Context

## Available Commands

This project has custom commands to help you work efficiently:

### `/read` Command
Read and analyze files or directories with smart context awareness.

### `/write` Command
Create or modify files with proper formatting and structure.

## Working Directory

**IMPORTANT:** All file operations should be performed in the **root directory** (`./`) of this project.

## Project Structure

```
./                              # Root directory - work here
├── .claude/                     # Configuration (protected)
│   ├── hooks/                   # Sync hooks
│   │   ├── minio-pull-sync.ts  # Pull from MinIO
│   │   └── minio-push-sync.ts  # Push to MinIO
│   └── tmp/                     # Temporary files
├── markdown/                    # Example synced folder
└── ...                          # Your project files
```

## Working with Files

When working with files in this project:
- Use the `/read` command to examine existing files
- Use the `/write` command to create or update files
- **Always use relative paths** from the root directory (`./`)
- **Example:** `markdown/file.md` NOT `~/projects/.../markdown/file.md`
- The system automatically syncs changes with remote storage

## Important Notes

- Files are automatically synced between local and remote storage
- Configuration files (`.env`) are located in `.claude/hooks/`
- The `.claude/` directory and its contents are protected from deletion

## Configuration

- API endpoint: Set in `.claude/hooks/.env` as `API_HOOK_URL`
- Project ID: Automatically configured (do not modify)
- Protected directories: `.claude/`, `tmp/`, `node_modules/`, `.git/`
