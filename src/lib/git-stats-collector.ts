/**
 * Git Stats Collector - Capture git changes snapshot on stream completion
 *
 * Collects git diff stats (additions/deletions) when streaming finishes.
 * Only runs once per attempt, on final result.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

import { createLogger } from './logger';

const log = createLogger('GitStatsCollector');

const execAsync = promisify(exec);

/**
 * Git statistics snapshot
 */
export interface GitStats {
  additions: number;
  deletions: number;
  filesChanged: number;
  capturedAt: number;
}

/**
 * Parse git diff --numstat output
 * Format: <additions>\t<deletions>\t<filename>
 */
function parseNumstat(output: string): GitStats {
  const lines = output.trim().split('\n').filter(Boolean);

  let additions = 0;
  let deletions = 0;
  let filesChanged = 0;

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const [add, del] = parts;

    // Handle binary files (marked as '-')
    if (add !== '-') additions += parseInt(add, 10) || 0;
    if (del !== '-') deletions += parseInt(del, 10) || 0;

    filesChanged++;
  }

  return {
    additions,
    deletions,
    filesChanged,
    capturedAt: Date.now(),
  };
}

/**
 * Collect git diff stats for current working directory
 */
export async function collectGitStats(cwd: string): Promise<GitStats | null> {
  try {
    // Get git diff --numstat (staged + unstaged changes)
    const { stdout } = await execAsync('git diff --numstat HEAD', { cwd });

    if (!stdout.trim()) {
      // No changes
      return {
        additions: 0,
        deletions: 0,
        filesChanged: 0,
        capturedAt: Date.now(),
      };
    }

    return parseNumstat(stdout);
  } catch (error) {
    // Not a git repo or git command failed
    log.error({ error: error }, '[GitStats] Failed to collect git stats:');
    return null;
  }
}

/**
 * In-memory cache for git stats per attempt
 */
class GitStatsCache {
  private cache = new Map<string, GitStats | null>();

  set(attemptId: string, stats: GitStats | null): void {
    this.cache.set(attemptId, stats);
  }

  get(attemptId: string): GitStats | null | undefined {
    return this.cache.get(attemptId);
  }

  clear(attemptId: string): void {
    this.cache.delete(attemptId);
  }

  getAll(): Map<string, GitStats | null> {
    return this.cache;
  }
}

// Export singleton cache
export const gitStatsCache = new GitStatsCache();
