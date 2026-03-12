/**
 * Session Manager File Operations
 *
 * Handles all filesystem interactions for Claude session (.jsonl) files:
 * locating, validating, and scanning session files for corruption or API errors.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { createLogger } from '@/lib/logger';

const log = createLogger('SessionFileOps');

/**
 * Get the file path for a session ID by scanning ~/.claude/projects
 * Returns null if file doesn't exist
 */
export function getSessionFilePath(sessionId: string): string | null {
  const claudeDir = path.join(os.homedir(), '.claude');
  const projectsDir = path.join(claudeDir, 'projects');

  if (!fs.existsSync(projectsDir)) return null;

  const projectDirs = fs.readdirSync(projectsDir);
  for (const projectDir of projectDirs) {
    const candidatePath = path.join(projectsDir, projectDir, `${sessionId}.jsonl`);
    if (fs.existsSync(candidatePath)) return candidatePath;
  }
  return null;
}

/**
 * Check if a session file exists on disk
 */
export function sessionFileExists(sessionId: string): boolean {
  return getSessionFilePath(sessionId) !== null;
}

/**
 * Validate session file — exists, non-empty, and has real conversation content.
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateSessionFile(sessionId: string): { valid: boolean; reason?: string } {
  const filePath = getSessionFilePath(sessionId);
  if (!filePath) return { valid: false, reason: 'file_not_found' };

  try {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) return { valid: false, reason: 'file_empty' };

    // Stub sessions with only queue-operation/file-history-snapshot entries can't be resumed
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { valid: false, reason: 'no_valid_entries' };

    let hasConversationContent = false;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'user' || entry.type === 'assistant' || entry.type === 'result') {
          hasConversationContent = true;
          break;
        }
      } catch {
        return { valid: false, reason: 'invalid_json' };
      }
    }

    if (!hasConversationContent) return { valid: false, reason: 'no_conversation_content' };
    return { valid: true };
  } catch {
    return { valid: false, reason: 'read_error' };
  }
}

/**
 * Check if a session file ends with API errors and find the last good assistant message UUID.
 * Returns the UUID of the last successful assistant message, or null if session is clean.
 */
export async function findLastGoodMessageInSession(sessionId: string): Promise<string | null> {
  const sessionFilePath = getSessionFilePath(sessionId);
  if (!sessionFilePath) {
    log.debug(`Session file not found for ${sessionId}`);
    return null;
  }

  const lines: string[] = [];
  const fileStream = fs.createReadStream(sessionFilePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.trim()) lines.push(line);
  }

  // Check if session ends with an API error (scan last 10 lines)
  let hasApiErrorAtEnd = false;
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.isApiErrorMessage) {
        hasApiErrorAtEnd = true;
        break;
      }
    } catch {
      log.error(`Failed to parse session line ${i} for session ${sessionId}: ${lines[i]}`);
      const lastLines = lines.slice(-20);
      log.error(`Last ${lastLines.length} lines of session ${sessionId}:\n${lastLines.join('\n')}`);
    }
  }

  if (!hasApiErrorAtEnd) return null;

  log.info(`Session ${sessionId} has API errors at end, finding last good message`);

  // Find the last successful assistant message (not an API error)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === 'assistant' && !entry.isApiErrorMessage && entry.uuid) {
        log.info(`Found last good message: ${entry.uuid}`);
        return entry.uuid;
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return null;
}
