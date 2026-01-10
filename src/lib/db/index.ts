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
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, status, position);

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
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
}

// Initialize on first import
initDb();

export { schema };
