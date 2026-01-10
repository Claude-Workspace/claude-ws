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

// Type exports for queries
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type AttemptLog = typeof attemptLogs.$inferSelect;
export type NewAttemptLog = typeof attemptLogs.$inferInsert;
