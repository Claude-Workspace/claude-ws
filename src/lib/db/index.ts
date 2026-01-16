import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Database file path - stored in project root
const DB_PATH = path.join(process.cwd(), 'data', 'claude-kanban.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite connection
const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL');

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Initialize database tables
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),
      position INTEGER NOT NULL,
      chat_init INTEGER NOT NULL DEFAULT 0,
      rewind_session_id TEXT,
      rewind_message_uuid TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, status, position);

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      display_prompt TEXT,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
      session_id TEXT,
      branch TEXT,
      diff_additions INTEGER NOT NULL DEFAULT 0,
      diff_deletions INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_task ON attempts(task_id, created_at);

    CREATE TABLE IF NOT EXISTS attempt_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('stdout', 'stderr', 'json')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_logs_attempt ON attempt_logs(attempt_id, created_at);

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      message_count INTEGER NOT NULL,
      summary TEXT,
      git_commit_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_checkpoints_task ON checkpoints(task_id, created_at);

    CREATE TABLE IF NOT EXISTS attempt_files (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_attempt_files_attempt ON attempt_files(attempt_id);

    CREATE TABLE IF NOT EXISTS shells (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      attempt_id TEXT REFERENCES attempts(id) ON DELETE SET NULL,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL,
      pid INTEGER,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'stopped', 'crashed')),
      exit_code INTEGER,
      exit_signal TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      stopped_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_shells_project ON shells(project_id, status);
  `);

  // Migration: Add session_id column if it doesn't exist (for existing databases)
  try {
    sqlite.exec(`ALTER TABLE attempts ADD COLUMN session_id TEXT`);
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add display_prompt column for showing original user input
  try {
    sqlite.exec(`ALTER TABLE attempts ADD COLUMN display_prompt TEXT`);
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add chat_init column to tasks for tracking if chat has been initialized
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN chat_init INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add git_commit_hash column to checkpoints for file rewind
  try {
    sqlite.exec(`ALTER TABLE checkpoints ADD COLUMN git_commit_hash TEXT`);
  } catch {
    // Column already exists, ignore error
  }

  // Migration: Add rewind columns to tasks for conversation context rewind
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN rewind_session_id TEXT`);
  } catch {
    // Column already exists, ignore error
  }
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN rewind_message_uuid TEXT`);
  } catch {
    // Column already exists, ignore error
  }

  // Agent Factory tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_factory_plugins (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('skill', 'command', 'agent', 'agent_set')),
      name TEXT NOT NULL,
      description TEXT,
      source_path TEXT,
      storage_type TEXT NOT NULL DEFAULT 'local' CHECK(storage_type IN ('local', 'imported', 'external')),
      agent_set_path TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS project_plugins (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      plugin_id TEXT NOT NULL REFERENCES agent_factory_plugins(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_project_plugins ON project_plugins(project_id, plugin_id);

    CREATE TABLE IF NOT EXISTS plugin_dependencies (
      id TEXT PRIMARY KEY,
      plugin_id TEXT NOT NULL REFERENCES agent_factory_plugins(id) ON DELETE CASCADE,
      dependency_type TEXT NOT NULL CHECK(dependency_type IN ('python', 'npm', 'system', 'skill', 'agent')),
      spec TEXT NOT NULL,
      plugin_dependency_id TEXT REFERENCES agent_factory_plugins(id) ON DELETE SET NULL,
      installed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_plugin_deps ON plugin_dependencies(plugin_id);
    CREATE INDEX IF NOT EXISTS idx_plugin_depends_on ON plugin_dependencies(plugin_dependency_id);

    CREATE TABLE IF NOT EXISTS plugin_dependency_cache (
      id TEXT PRIMARY KEY,
      plugin_id TEXT REFERENCES agent_factory_plugins(id) ON DELETE CASCADE,
      source_path TEXT,
      source_hash TEXT,
      type TEXT NOT NULL CHECK(type IN ('skill', 'command', 'agent')),
      library_deps TEXT,
      plugin_deps TEXT,
      install_script_npm TEXT,
      install_script_pnpm TEXT,
      install_script_yarn TEXT,
      install_script_pip TEXT,
      install_script_poetry TEXT,
      install_script_cargo TEXT,
      install_script_go TEXT,
      dockerfile TEXT,
      depth INTEGER NOT NULL DEFAULT 0,
      has_cycles INTEGER NOT NULL DEFAULT 0,
      resolved_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_cache_plugin ON plugin_dependency_cache(plugin_id);
    CREATE INDEX IF NOT EXISTS idx_cache_source ON plugin_dependency_cache(source_path);
  `);
}

// Initialize on first import
initDb();

export { schema };
