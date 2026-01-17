# Project Overview & Product Development Requirements (PDR)

## Project Overview
Claude Kanban is an AI-powered development environment that combines a visual Kanban board with the Claude Agent SDK. It provides a seamless interface for developers to manage tasks, collaborate with AI to implement features, and manage their git workflow without leaving the application.

## Product Requirements

### Functional Requirements
1. **Kanban Task Management**
   - Create, update, delete, and reorder tasks across status columns (Todo, In Progress, In Review, Done).
   - Track task status and position within columns.
2. **AI Assistant Integration**
   - Integrated chat interface for each task.
   - Real-time streaming of AI responses.
   - Tool-use capabilities (Bash, Filesystem access, etc.).
   - Interactive slash commands (/rewind, /model, /config).
   - Conversation checkpoints and state persistence.
3. **Git Integration**
   - View repository status (branch, staged/unstaged/untracked changes).
   - File diff visualization.
   - Staging, unstaging, and discarding changes.
   - Committing with manually entered or AI-generated messages.
   - Push/Pull/Fetch operations.
4. **Agent Factory (Plugins)**
   - Extensible system for custom skills and commands.
   - Discovery and import of plugin packages.
   - Dependency management for plugins.
5. **Real-time Terminal**
   - Background shell execution with real-time output streaming via WebSockets.

### Non-Functional Requirements
1. **Performance**
   - Real-time responsiveness for chat and terminal output.
   - Efficient handling of large git diffs.
   - Responsive UI with optimistic updates for Kanban operations.
2. **Security**
   - Path escape protection for filesystem operations.
   - Optional API key authentication.
   - Restricted file types for uploads.
3. **User Experience**
   - Clean, developer-focused interface using Shadcn/UI.
   - Intuitive keyboard shortcuts and navigation.
   - Persistent session state across reloads.

## AI Commit Message Generation (Feature Specification)
- **Goal**: Automate the creation of high-quality, conventional commit messages to improve git history consistency.
- **Implementation**:
  - Backend analyzes `git diff --cached` output.
  - Claude (Sonnet model) processes the diff with specific instructions for conventional commits.
  - Results are filtered and extracted to ensure only the commit message is returned.
- **Acceptance Criteria**:
  - Must require staged changes to run.
  - Must follow `type(scope): description` format.
  - Must be triggered by a single click in the Git Panel.
  - Must handle API errors (rate limits, auth) gracefully with user feedback.
