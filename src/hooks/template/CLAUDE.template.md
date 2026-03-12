# Project Commands & Context

## Available Commands

This project has custom commands to help you work efficiently:

### `/read` Command
Read and analyze files or directories with smart context awareness.

### `/write` Command
Create or modify files with proper formatting and structure.

## Project Structure

- Project files are synced at the root level
- Configuration and hooks are in `.claude/` directory
- State files are stored in `.claude/tmp/`

## Working with Files

When working with files in this project:
- Use the `/read` command to examine existing files
- Use the `/write` command to create or update files
- The system automatically syncs changes with remote storage

## Important Notes

- Files are automatically synced between local and remote storage
- Configuration files (`.env`) are located in `.claude/hooks/`
- Temporary state files are stored in `.claude/tmp/`
- The `.claude/` directory and its contents are protected from deletion
