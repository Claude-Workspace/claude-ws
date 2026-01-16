# Plan: Project Settings with Component/Agent Set Selection

## Summary
Add settings button next to "All projects" in project dropdown that opens project settings page. Allow selecting components/agent sets per project and copy selected items to project's `.claude` folder.

## Context
- Current: Project dropdown exists in `src/components/header/project-selector.tsx`
- Has "All Projects" checkbox item with project list
- Need: Settings button next to "All Projects" text
- Goal: Per-project component/agent set configuration that copies to `.claude/` folder

## Implementation Approach

### Phase 1: UI - Settings Button Entry
**File**: `src/components/header/project-selector.tsx`

1. **Add Settings Button**
   - Place settings icon button next to "All Projects" checkbox
   - Use `Settings` icon from lucide-react
   - Open project settings dialog when clicked
   - Style: Small icon button, minimal visual weight

2. **Create Project Settings Dialog**
   - New file: `src/components/project-settings/project-settings-dialog.tsx`
   - Features:
     - Project selector tabs at top (one tab per project)
     - Two sections per project: Components | Agent Sets
     - Multi-select lists with checkboxes
     - Search/filter for components
     - Save/Cancel buttons (manual save trigger)
     - Status indicators (copied, pending)

### Phase 2: Backend - Storage & APIs

**File**: `src/types/index.ts`
- Add to Project type:
  ```typescript
  settings?: {
    selectedComponents: string[];  // component IDs
    selectedAgentSets: string[];   // agent set IDs
  }
  ```

**File**: `src/app/api/projects/[id]/settings/route.ts`
- GET: Fetch project settings
- POST: Update project settings
- PATCH: Partial update

**File**: `src/app/api/agent-factory/projects/[projectId]/sync/route.ts`
- POST: Copy selected components to `.claude/` folder
- Returns: List of copied files, conflicts, errors

### Phase 3: Components - Selection Lists

**File**: `src/components/project-settings/component-selector.tsx`
- Fetch available components from `/api/agent-factory/components`
- Multi-select with search
- Show component metadata (name, description, dependencies)
- Group by category/type

**File**: `src/components/project-settings/agent-set-selector.tsx`
- Similar to component selector
- Show agent sets with their components

### Phase 4: File Copy Logic

**File**: `src/app/api/agent-factory/projects/[projectId]/sync/route.ts`
- Logic:
  1. Read project settings (selected components/agent sets)
  2. For each selected item:
     - Fetch component files from `/api/agent-factory/components/[id]/files`
     - Resolve target path: `<projectPath>/.claude/components/<name>/`
     - Copy files, handle conflicts (skip/overwrite/merge)
  3. Update `.claude/config.json` with component references
  4. Return sync status

**File**: `src/lib/project-sync.ts` (shared utilities)
- Function: `syncComponentsToProject(projectId, componentIds)`
- Function: `syncAgentSetsToProject(projectId, agentSetIds)`
- Handle file system operations safely

### Phase 5: State Management

**File**: `src/stores/project-settings-store.ts`
- Store: Project settings state
- Actions:
  - `fetchProjectSettings(projectId)`
  - `updateProjectSettings(projectId, settings)`
  - `syncProject(projectId)`
- Track: Loading states, sync status, errors

### Phase 6: Integration & Polish

**Updates**:
- Wire settings button → dialog
- Connect selectors → store
- Implement save → API → file sync
- Add loading states during sync
- Success/error notifications
- Show last sync time

## File Structure

```
src/
├── components/
│   ├── header/
│   │   └── project-selector.tsx          // MODIFY: Add settings button
│   └── project-settings/
│       ├── project-settings-dialog.tsx   // NEW: Main dialog
│       ├── component-selector.tsx        // NEW: Component selection
│       └── agent-set-selector.tsx        // NEW: Agent set selection
├── app/api/
│   ├── projects/
│   │   └── [id]/
│   │       └── settings/
│   │           └── route.ts              // NEW: Settings CRUD
│   └── agent-factory/
│       └── projects/
│           └── [projectId]/
│               └── sync/
│                   └── route.ts          // NEW: Copy files to .claude
├── stores/
│   └── project-settings-store.ts         // NEW: Settings state
├── lib/
│   └── project-sync.ts                   // NEW: Sync utilities
└── types/
    └── index.ts                          // MODIFY: Add settings type
```

## Resolved Requirements

1. **UI Behavior**: Per-project tabs in settings dialog ✓
2. **Component Copy**: Manual save button (not auto-copy) ✓
3. **Sync Timing**: Triggered only on Save button click ✓

## Open Questions

1. **Component Storage**: Where are global components stored? Need API to list available
2. **Conflict Resolution**: When `.claude/components/<name>/` exists - overwrite, merge, or skip?
3. **Config Format**: What's the structure of `.claude/config.json` for component references?
4. **Agent Sets**: How are agent sets defined? Similar structure to components?
