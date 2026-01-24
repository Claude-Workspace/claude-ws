# Claude Kanban Project Roadmap

**Last Updated:** 2026-01-24
**Version:** 0.2.0

## Overview

Claude Kanban is a modern project management application built with Next.js, TypeScript, and shadcn/ui components.

## Current Development Status

### Active Feature: File Explorer Context Menu

**Plan ID:** 260124-1552-file-explorer-context-menu
**Status:** In Progress (20% complete)
**Started:** 2026-01-24
**Priority:** P2
**Effort:** 5 hours

#### Phase Progress

| Phase | Status | Progress | Completed |
|-------|--------|----------|-----------|
| 01. Setup & Dependencies | ✅ Done | 100% | 2026-01-24 |
| 02. Backend API Routes | Pending | 0% | - |
| 03. Frontend Components | Pending | 0% | - |
| 04. Integration | Pending | 0% | - |
| 05. Testing & Edge Cases | Pending | 0% | - |

#### Description
Add right-click context menu to file tree items enabling file operations: delete, download as ZIP, copy absolute path.

#### Key Features
- Right-click context menu for files/folders
- Touch support (long-press 500ms)
- Delete with confirmation
- Download as ZIP
- Copy path to clipboard
- Keyboard navigation (Escape, arrows)
- Security (path traversal prevention)

#### Technical Stack
- UI: Radix UI Context Menu (shadcn/ui)
- Backend: Next.js API Routes
- File Operations: Node.js fs/promises, adm-zip
- State Management: Zustand (sidebar-store)

## Upcoming Features

TBD - Feature planning in progress

## Completed Features

### v0.2.0 - Current Release
- File browser with tree navigation
- Sidebar with file explorer
- Editor tab management
- Project-level commands
- System prompt management

## Milestones

### Q1 2026
- [ ] File Explorer Context Menu (In Progress)
- [ ] Enhanced file operations
- [ ] Improved keyboard navigation

### Q2 2026
- TBD

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Path traversal attacks | High | Validate with path.relative() |
| File operation timeouts | Medium | Implement timeout handling |
| Large ZIP downloads | Medium | Monitor performance |

## Change Log

See [Git History](https://github.com/yourusername/claude-kanban/commits/main) for detailed changes.
