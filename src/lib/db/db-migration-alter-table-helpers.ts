/**
 * DB Migration Alter Table Helpers - Safe ALTER TABLE column addition utilities
 *
 * Extracted from db/index.ts. Provides helpers to add columns to existing tables
 * without failing if columns already exist (idempotent migrations).
 */

import Database from 'better-sqlite3';

/**
 * Safely add a single column to a table, ignoring "already exists" errors.
 */
export function addColumnIfNotExists(
  sqlite: InstanceType<typeof Database>,
  table: string,
  column: string,
  type: string
): void {
  try {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // Column already exists, ignore error
  }
}

/**
 * Safely add multiple columns to a table in one call.
 */
export function addColumnsIfNotExist(
  sqlite: InstanceType<typeof Database>,
  table: string,
  columns: Array<{ name: string; type: string }>
): void {
  for (const col of columns) {
    addColumnIfNotExists(sqlite, table, col.name, col.type);
  }
}

/**
 * Run all schema migrations for the attempts table (usage, output format columns, etc.)
 */
export function runAttemptsMigrations(sqlite: InstanceType<typeof Database>): void {
  // session_id for resumable sessions
  addColumnIfNotExists(sqlite, 'attempts', 'session_id', 'TEXT');

  // display_prompt for showing original user input
  addColumnIfNotExists(sqlite, 'attempts', 'display_prompt', 'TEXT');

  // Usage tracking columns
  addColumnsIfNotExist(sqlite, 'attempts', [
    { name: 'total_tokens', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'input_tokens', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'output_tokens', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'cache_creation_tokens', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'cache_read_tokens', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'total_cost_usd', type: "TEXT NOT NULL DEFAULT '0'" },
    { name: 'num_turns', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'duration_ms', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'context_used', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'context_limit', type: 'INTEGER NOT NULL DEFAULT 200000' },
    { name: 'context_percentage', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'baseline_context', type: 'INTEGER NOT NULL DEFAULT 0' },
  ]);

  // Output format columns for custom output formatting
  addColumnsIfNotExist(sqlite, 'attempts', [
    { name: 'output_format', type: 'TEXT' },
    { name: 'output_schema', type: 'TEXT' },
  ]);
}

/**
 * Run all schema migrations for the tasks table.
 */
export function runTasksMigrations(sqlite: InstanceType<typeof Database>): void {
  // chat_init for tracking if chat has been initialized
  addColumnIfNotExists(sqlite, 'tasks', 'chat_init', 'INTEGER NOT NULL DEFAULT 0');

  // rewind columns for conversation context rewind
  addColumnIfNotExists(sqlite, 'tasks', 'rewind_session_id', 'TEXT');
  addColumnIfNotExists(sqlite, 'tasks', 'rewind_message_uuid', 'TEXT');

  // last_model for per-task model selection
  addColumnIfNotExists(sqlite, 'tasks', 'last_model', 'TEXT');
}

/**
 * Run all schema migrations for the checkpoints table.
 */
export function runCheckpointsMigrations(sqlite: InstanceType<typeof Database>): void {
  // git_commit_hash for file rewind
  addColumnIfNotExists(sqlite, 'checkpoints', 'git_commit_hash', 'TEXT');
}
