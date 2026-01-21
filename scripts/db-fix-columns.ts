#!/usr/bin/env tsx
/**
 * Pre-migration script to add missing columns to existing databases.
 * Run this before drizzle migrations if you have an old database.
 *
 * Usage: pnpm db:fix
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

const DB_DIR = path.join(os.homedir(), '.claude-ws');
const DB_PATH = path.join(DB_DIR, 'claude-ws.db');

if (!fs.existsSync(DB_PATH)) {
  console.log('Database does not exist yet. No fix needed.');
  process.exit(0);
}

const sqlite = new Database(DB_PATH);

// Columns to add to attempts table
const usageColumns = [
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
];

console.log('Checking and adding missing columns to attempts table...');

let addedCount = 0;
for (const col of usageColumns) {
  try {
    sqlite.exec(`ALTER TABLE attempts ADD COLUMN ${col.name} ${col.type}`);
    console.log(`  Added column: ${col.name}`);
    addedCount++;
  } catch {
    // Column already exists
  }
}

if (addedCount === 0) {
  console.log('All columns already exist. Database is up to date.');
} else {
  console.log(`Added ${addedCount} missing columns.`);
}

sqlite.close();
console.log('Done.');
