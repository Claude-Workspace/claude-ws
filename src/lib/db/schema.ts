import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Projects table - workspace configuration
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .$defaultFn(() => Date.now()),
});

// Tasks table - Kanban cards
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', {
      enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'],
    })
      .notNull()
      .default('todo'),
    position: integer('position').notNull(),
    chatInit: integer('chat_init', { mode: 'boolean' }).notNull().default(false),
    // Rewind state - cleared after first use
    // Session ID to resume from after rewind
    rewindSessionId: text('rewind_session_id'),
    // Message UUID to resume at (for conversation context rewind)
    rewindMessageUuid: text('rewind_message_uuid'),
    createdAt: integer('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_tasks_project').on(table.projectId, table.status, table.position),
  ]
);

// Attempts table - each prompt submission per task
export const attempts = sqliteTable(
  'attempts',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(), // Full expanded prompt sent to Claude
    displayPrompt: text('display_prompt'), // Original user input (e.g., "/cook build auth")
    status: text('status', {
      enum: ['running', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('running'),
    sessionId: text('session_id'), // Claude CLI session ID for --resume
    branch: text('branch'),
    diffAdditions: integer('diff_additions').notNull().default(0),
    diffDeletions: integer('diff_deletions').notNull().default(0),
    createdAt: integer('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    completedAt: integer('completed_at', { mode: 'number' }),
  },
  (table) => [
    index('idx_attempts_task').on(table.taskId, table.createdAt),
  ]
);

// Attempt logs table - streaming output chunks
export const attemptLogs = sqliteTable(
  'attempt_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    attemptId: text('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['stdout', 'stderr', 'json'] }).notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_logs_attempt').on(table.attemptId, table.createdAt),
  ]
);

// Attempt files table - file attachments per attempt
export const attemptFiles = sqliteTable(
  'attempt_files',
  {
    id: text('id').primaryKey(),
    attemptId: text('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(), // Stored name (uuid-based)
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(), // Bytes
    createdAt: integer('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index('idx_attempt_files_attempt').on(table.attemptId)]
);

// Checkpoints table - conversation state snapshots for rewind
export const checkpoints = sqliteTable(
  'checkpoints',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    attemptId: text('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(), // Claude session ID for --resume
    gitCommitHash: text('git_commit_hash'), // Git commit hash for file rewind
    messageCount: integer('message_count').notNull(),
    summary: text('summary'), // Auto-generated summary from last assistant message
    createdAt: integer('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_checkpoints_task').on(table.taskId, table.createdAt),
  ]
);

// Agent Factory Components table - skills, commands, agents registry
export const agentFactoryComponents = sqliteTable('agent_factory_components', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['skill', 'command', 'agent', 'agent_set'] }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sourcePath: text('source_path'), // Path in .claude/agentfactory/ or external (null for agent sets)
  storageType: text('storage_type', { enum: ['local', 'imported', 'external'] }).notNull().default('local'),
  agentSetPath: text('agent_set_path'), // For agent sets: path to the agent set folder
  metadata: text('metadata'), // JSON for extra properties
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'number' })
    .notNull()
    .$defaultFn(() => Date.now()),
});

// Project Components table - many-to-many relationship between projects and components
export const projectComponents = sqliteTable(
  'project_components',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    componentId: text('component_id')
      .notNull()
      .references(() => agentFactoryComponents.id, { onDelete: 'cascade' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_project_components').on(table.projectId, table.componentId),
  ]
);

// Component Dependencies table - track package and component dependencies
export const componentDependencies = sqliteTable(
  'component_dependencies',
  {
    id: text('id').primaryKey(),
    componentId: text('component_id')
      .notNull()
      .references(() => agentFactoryComponents.id, { onDelete: 'cascade' }),
    dependencyType: text('dependency_type', { enum: ['python', 'npm', 'system', 'skill', 'agent'] }).notNull(),
    spec: text('spec').notNull(), // e.g. "package>=1.0.0" or component name
    componentDependencyId: text('component_dependency_id').references(() => agentFactoryComponents.id, { onDelete: 'set null' }), // For skill/agent deps
    installed: integer('installed', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_component_deps').on(table.componentId),
    index('idx_component_depends_on').on(table.componentDependencyId),
  ]
);

// Component Dependency Cache table - cache resolved dependency trees and install scripts
export const componentDependencyCache = sqliteTable(
  'component_dependency_cache',
  {
    id: text('id').primaryKey(),
    componentId: text('component_id').references(() => agentFactoryComponents.id, { onDelete: 'cascade' }),
    sourcePath: text('source_path'), // For discovered components
    sourceHash: text('source_hash'), // For cache invalidation
    type: text('type', { enum: ['skill', 'command', 'agent'] }).notNull(),
    libraryDeps: text('library_deps'), // JSON array of library dependencies
    componentDeps: text('component_deps'), // JSON array of component dependencies
    installScriptNpm: text('install_script_npm'),
    installScriptPnpm: text('install_script_pnpm'),
    installScriptYarn: text('install_script_yarn'),
    installScriptPip: text('install_script_pip'),
    installScriptPoetry: text('install_script_poetry'),
    installScriptCargo: text('install_script_cargo'),
    installScriptGo: text('install_script_go'),
    dockerfile: text('dockerfile'),
    depth: integer('depth').notNull().default(0),
    hasCycles: integer('has_cycles', { mode: 'boolean' }).notNull().default(false),
    resolvedAt: integer('resolved_at', { mode: 'number' }).notNull(),
    createdAt: integer('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index('idx_cache_component').on(table.componentId),
    index('idx_cache_source').on(table.sourcePath),
  ]
);

// Type exports for queries
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type AttemptLog = typeof attemptLogs.$inferSelect;
export type NewAttemptLog = typeof attemptLogs.$inferInsert;
export type Checkpoint = typeof checkpoints.$inferSelect;
export type NewCheckpoint = typeof checkpoints.$inferInsert;
export type AttemptFile = typeof attemptFiles.$inferSelect;
export type NewAttemptFile = typeof attemptFiles.$inferInsert;
export type AgentFactoryComponent = typeof agentFactoryComponents.$inferSelect;
export type NewAgentFactoryComponent = typeof agentFactoryComponents.$inferInsert;
export type ProjectComponent = typeof projectComponents.$inferSelect;
export type NewProjectComponent = typeof projectComponents.$inferInsert;
export type ComponentDependency = typeof componentDependencies.$inferSelect;
export type NewComponentDependency = typeof componentDependencies.$inferInsert;
export type ComponentDependencyCache = typeof componentDependencyCache.$inferSelect;
export type NewComponentDependencyCache = typeof componentDependencyCache.$inferInsert;
