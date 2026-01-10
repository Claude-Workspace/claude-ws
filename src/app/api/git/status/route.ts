import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import type { GitStatus, GitFileStatusCode } from '@/types';

const execFileAsync = promisify(execFile);

// Timeout for git commands (5 seconds)
const GIT_TIMEOUT = 5000;

// GET /api/git/status?path=/project/path
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectPath = searchParams.get('path');

    if (!projectPath) {
      return NextResponse.json(
        { error: 'path parameter is required' },
        { status: 400 }
      );
    }

    // Validate project path exists and is a directory
    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
      return NextResponse.json(
        { error: 'Invalid project path' },
        { status: 400 }
      );
    }

    // Get git status with branch info using execFile (safe, no shell injection)
    const { stdout: statusOutput } = await execFileAsync(
      'git',
      ['status', '--porcelain', '-b'],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );

    // Get diff stats for staged and unstaged files
    const [stagedStats, unstagedStats] = await Promise.all([
      getDiffStats(resolvedPath, true),
      getDiffStats(resolvedPath, false),
    ]);

    const lines = statusOutput.trim().split('\n');
    const status: GitStatus = {
      branch: '',
      staged: [],
      unstaged: [],
      untracked: [],
      ahead: 0,
      behind: 0,
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // First line is branch info: ## branch...origin/branch [ahead N, behind M]
      if (i === 0 && line.startsWith('##')) {
        const branchInfo = parseBranchLine(line);
        status.branch = branchInfo.branch;
        status.ahead = branchInfo.ahead;
        status.behind = branchInfo.behind;
        continue;
      }

      if (!line || line.length < 3) continue;

      // Status format: XY path
      // X = index status, Y = worktree status
      const indexStatus = line[0];
      const worktreeStatus = line[1];
      const filePath = line.slice(3).trim();

      // Handle renamed files (have arrow in path)
      const actualPath = filePath.includes(' -> ')
        ? filePath.split(' -> ')[1]
        : filePath;

      // Untracked files
      if (indexStatus === '?' && worktreeStatus === '?') {
        status.untracked.push({
          path: actualPath,
          status: '?',
        });
        continue;
      }

      // Staged changes (index has status)
      if (indexStatus !== ' ' && indexStatus !== '?') {
        const stats = stagedStats.get(actualPath);
        status.staged.push({
          path: actualPath,
          status: mapStatusCode(indexStatus),
          additions: stats?.additions,
          deletions: stats?.deletions,
        });
      }

      // Unstaged changes (worktree has status)
      if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
        const stats = unstagedStats.get(actualPath);
        status.unstaged.push({
          path: actualPath,
          status: mapStatusCode(worktreeStatus),
          additions: stats?.additions,
          deletions: stats?.deletions,
        });
      }
    }

    return NextResponse.json(status);
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };

    // Check if not a git repository
    if (err.message?.includes('not a git repository')) {
      return NextResponse.json(
        { error: 'Not a git repository' },
        { status: 400 }
      );
    }

    // Timeout error
    if (err.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: 'Git command timed out' },
        { status: 504 }
      );
    }

    console.error('Error getting git status:', error);
    return NextResponse.json(
      { error: 'Failed to get git status' },
      { status: 500 }
    );
  }
}

function parseBranchLine(line: string): { branch: string; ahead: number; behind: number } {
  // Format: ## branch...origin/branch [ahead N, behind M]
  // or just: ## branch
  let branch = '';
  let ahead = 0;
  let behind = 0;

  // Remove ## prefix
  const content = line.slice(3);

  // Extract ahead/behind info if present
  const bracketMatch = content.match(/\[(.+)\]/);
  if (bracketMatch) {
    const info = bracketMatch[1];
    const aheadMatch = info.match(/ahead (\d+)/);
    const behindMatch = info.match(/behind (\d+)/);
    if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
    if (behindMatch) behind = parseInt(behindMatch[1], 10);
  }

  // Extract branch name (before ... or end)
  const branchPart = content.split('[')[0].trim();
  branch = branchPart.split('...')[0].trim();

  // Handle detached HEAD
  if (branch.includes('HEAD detached')) {
    branch = 'HEAD (detached)';
  }

  return { branch, ahead, behind };
}

function mapStatusCode(code: string): GitFileStatusCode {
  const statusMap: Record<string, GitFileStatusCode> = {
    'M': 'M', // Modified
    'A': 'A', // Added
    'D': 'D', // Deleted
    'R': 'R', // Renamed
    'C': 'A', // Copied (treat as added)
    'U': 'U', // Unmerged
  };
  return statusMap[code] || 'M';
}

async function getDiffStats(
  cwd: string,
  staged: boolean
): Promise<Map<string, { additions: number; deletions: number }>> {
  const stats = new Map<string, { additions: number; deletions: number }>();

  try {
    const args = ['diff', '--numstat'];
    if (staged) args.push('--cached');

    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: GIT_TIMEOUT,
    });

    // Parse numstat output: additions\tdeletions\tfilepath
    for (const line of stdout.trim().split('\n')) {
      if (!line) continue;
      const [add, del, filePath] = line.split('\t');
      if (filePath) {
        stats.set(filePath, {
          additions: add === '-' ? 0 : parseInt(add, 10) || 0,
          deletions: del === '-' ? 0 : parseInt(del, 10) || 0,
        });
      }
    }
  } catch {
    // Ignore errors, stats are optional
  }

  return stats;
}
