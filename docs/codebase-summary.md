# Codebase Summary

## Overview
Claude Kanban is a project management and development assistant application that integrates a Kanban board with the Claude Agent SDK. It allows developers to manage tasks, execute code, interact with git repositories, and leverage AI for development workflows.

## Technical Stack
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Shadcn/UI
- **State Management**: Zustand
- **AI Integration**: @anthropic-ai/claude-agent-sdk
- **Communication**: Socket.io for real-time streaming
- **Icons**: Lucide React

## Project Structure

### Core Directories
- `src/app`: Next.js pages and API routes
  - `src/app/api`: Backend API endpoints (Git, Tasks, Projects, etc.)
- `src/components`: React components
  - `src/components/sidebar`: Sidebar panels (File browser, Git, Task list)
  - `src/components/task`: Conversation and task-specific views
  - `src/components/ui`: Shared UI components (Shadcn)
- `src/lib`: Core utility functions and service logic
  - `src/lib/agent-manager.ts`: Interface with Claude SDK
  - `src/lib/socket-service.ts`: WebSocket management
- `src/stores`: Zustand state stores (Task, Sidebar, Project)
- `src/hooks`: Custom React hooks
- `src/types`: TypeScript type definitions

### Key Features
- **Kanban Board**: Visual task management with status columns
- **Claude Integration**: Chat interface powered by Claude Agent SDK with tool-use capabilities
- **Git Integration**: Full git workflow within the UI (Status, Diff, Stage, Commit, AI-generated messages)
- **Real-time Streaming**: Real-time response streaming and terminal output via WebSockets
- **Interactive Commands**: Slash commands (/rewind, /model, /config) with UI-driven interactions
- **Agent Factory**: Plugin system for skills, commands, and custom agents

## Git Workflow & AI Integration
The application includes a specialized AI commit message generation feature and a visual git graph.
- **Git Graph**: Real-time visualization of commit topology with local/remote detection.
  - **Lane Calculation**: Logic in `src/lib/git/lane-calculator.ts` handles horizontal positioning.
  - **Path Generation**: Logic in `src/lib/git/path-generator.ts` creates SVG paths for branch connections.
- **AI Commit Generation**: `POST /api/git/generate-message` analyzes staged git diffs and generates conventional commit messages using Claude.
- **UI**: Integrated into the `GitPanel` with the `GitGraph` component and "Sparkles" (Logo) button for AI messages.

## API Architecture
The system exposes a RESTful API under `/api` for project/task management and git operations, complemented by a WebSocket layer for long-running agent tasks and terminal interactions.
