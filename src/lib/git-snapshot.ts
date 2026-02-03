import { execSync } from 'child_process';

/**
 * Git snapshot utilities for checkpoint-based file rewind
 * Creates commits before Claude edits and restores them on rewind
 */

const SNAPSHOT_PREFIX = 'claude-ws-checkpoint';

/**
 * Check if directory is a git repository
 */
export function isGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current HEAD commit hash
 */
export function getCurrentCommit(cwd: string): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd, stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

/**
 * Check if working directory has uncommitted changes
 */
export function hasUncommittedChanges(cwd: string): boolean {
  try {
    const status = execSync('git status --porcelain', { cwd, stdio: 'pipe' })
      .toString()
      .trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

/**
 * Create a snapshot commit before Claude makes changes
 * Returns the commit hash or null if failed
 */
export function createSnapshot(
  cwd: string,
  attemptId: string,
  prompt: string
): string | null {
  if (!isGitRepo(cwd)) {
    console.log('[GitSnapshot] Not a git repo, skipping snapshot');
    return null;
  }

  try {
    // Stage all changes (including untracked)
    execSync('git add -A', { cwd, stdio: 'pipe' });

    // Check if there's anything to commit
    const status = execSync('git status --porcelain', { cwd, stdio: 'pipe' })
      .toString()
      .trim();

    if (status.length === 0) {
      // Nothing to commit, return current HEAD
      console.log('[GitSnapshot] No changes to commit, using current HEAD');
      return getCurrentCommit(cwd);
    }

    // Create snapshot commit with descriptive message
    const shortPrompt = prompt.substring(0, 50).replace(/"/g, '\\"');
    const message = `${SNAPSHOT_PREFIX}: ${attemptId}\n\nBefore: ${shortPrompt}...`;

    execSync(`git commit -m "${message}" --no-verify`, {
      cwd,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Claude Workspace',
        GIT_AUTHOR_EMAIL: 'claude-ws@local',
        GIT_COMMITTER_NAME: 'Claude Workspace',
        GIT_COMMITTER_EMAIL: 'claude-ws@local',
      },
    });

    const commitHash = getCurrentCommit(cwd);
    console.log(`[GitSnapshot] Created snapshot commit: ${commitHash}`);
    return commitHash;
  } catch (error) {
    console.error('[GitSnapshot] Failed to create snapshot:', error);
    // Return current HEAD as fallback
    return getCurrentCommit(cwd);
  }
}

/**
 * Rewind files to a specific commit
 * Uses git reset --hard to restore file state
 */
export function rewindToCommit(
  cwd: string,
  commitHash: string
): { success: boolean; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: 'Not a git repository' };
  }

  try {
    // Verify commit exists
    execSync(`git cat-file -t ${commitHash}`, { cwd, stdio: 'pipe' });

    // Hard reset to the commit
    execSync(`git reset --hard ${commitHash}`, { cwd, stdio: 'pipe' });

    console.log(`[GitSnapshot] Rewound to commit: ${commitHash}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GitSnapshot] Failed to rewind:', message);
    return { success: false, error: message };
  }
}

/**
 * Get list of snapshot commits for a project
 */
export function listSnapshots(
  cwd: string
): { hash: string; date: string; message: string }[] {
  if (!isGitRepo(cwd)) {
    return [];
  }

  try {
    const output = execSync(
      `git log --oneline --format="%H|%ci|%s" --grep="${SNAPSHOT_PREFIX}"`,
      { cwd, stdio: 'pipe' }
    )
      .toString()
      .trim();

    if (!output) return [];

    return output.split('\n').map((line) => {
      const [hash, date, ...messageParts] = line.split('|');
      return { hash, date, message: messageParts.join('|') };
    });
  } catch {
    return [];
  }
}

/**
 * Clean up old snapshot commits (optional, for maintenance)
 * Removes snapshot commits older than specified days
 */
export function cleanupOldSnapshots(cwd: string, olderThanDays: number = 30): void {
  // This is a placeholder - actual implementation would need interactive rebase
  // or filter-branch which is destructive. For now, we keep all snapshots.
  console.log(`[GitSnapshot] Cleanup not implemented (keeping all snapshots)`);
}
