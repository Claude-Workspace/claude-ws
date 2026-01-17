import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { FileEntry, GitFileStatusCode } from '@/types';

const execFileAsync = promisify(execFile);

// Directories to exclude from file tree
const EXCLUDED_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', '.turbo'];
const EXCLUDED_FILES = ['.DS_Store', 'Thumbs.db'];

// GET /api/files - List directory tree
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const basePath = searchParams.get('path');
    const depth = parseInt(searchParams.get('depth') || '10', 10);
    const showHidden = searchParams.get('showHidden') !== 'false';

    if (!basePath) {
      return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
    }

    // Resolve and validate path
    const resolvedPath = path.resolve(basePath);

    // Validate path exists
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'Path does not exist' }, { status: 404 });
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    // Get git status for files
    const gitStatus = await getGitStatusMap(resolvedPath);

    // Build file tree recursively
    const entries = buildFileTree(resolvedPath, resolvedPath, depth, showHidden, gitStatus);

    return NextResponse.json(
      { entries, basePath: resolvedPath },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Error reading directory:', error);
    return NextResponse.json(
      { error: 'Failed to read directory' },
      { status: 500 }
    );
  }
}

function buildFileTree(
  dirPath: string,
  basePath: string,
  maxDepth: number,
  showHidden: boolean,
  gitStatus: GitStatusResult,
  currentDepth: number = 0
): FileEntry[] {
  if (currentDepth >= maxDepth) return [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files unless showHidden is true
      if (!showHidden && entry.name.startsWith('.')) continue;

      // Skip excluded directories
      if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) continue;

      // Skip excluded files
      if (entry.isFile() && EXCLUDED_FILES.includes(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        const children = buildFileTree(fullPath, basePath, maxDepth, showHidden, gitStatus, currentDepth + 1);
        result.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children: children.length > 0 ? children : undefined,
        });
      } else {
        // Check file status directly or if inside untracked directory
        let fileGitStatus = gitStatus.fileStatus.get(relativePath);
        if (!fileGitStatus) {
          // Check if file is inside an untracked directory
          const isInUntrackedDir = gitStatus.untrackedDirs.some(
            dir => relativePath.startsWith(dir + '/')
          );
          if (isInUntrackedDir) {
            fileGitStatus = 'U';
          }
        }
        result.push({
          name: entry.name,
          path: relativePath,
          type: 'file',
          gitStatus: fileGitStatus,
        });
      }
    }

    // Sort: directories first, then alphabetically
    return result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

interface GitStatusResult {
  fileStatus: Map<string, GitFileStatusCode>;
  untrackedDirs: string[];
}

async function getGitStatusMap(cwd: string): Promise<GitStatusResult> {
  const fileStatus = new Map<string, GitFileStatusCode>();
  const untrackedDirs: string[] = [];

  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd,
      timeout: 5000,
    });

    for (const line of stdout.trim().split('\n')) {
      if (!line || line.length < 3) continue;

      const indexStatus = line[0];
      const worktreeStatus = line[1];
      let filePath = line.slice(3).trim();

      // Handle renamed files
      if (filePath.includes(' -> ')) {
        filePath = filePath.split(' -> ')[1];
      }

      // Untracked files/directories
      if (indexStatus === '?' && worktreeStatus === '?') {
        // If ends with /, it's an untracked directory
        if (filePath.endsWith('/')) {
          untrackedDirs.push(filePath.slice(0, -1));
        } else {
          fileStatus.set(filePath, 'U');
        }
        continue;
      }

      // Modified, added, deleted, etc.
      const status = indexStatus !== ' ' ? indexStatus : worktreeStatus;
      if (status === 'M' || status === 'A' || status === 'D' || status === 'R') {
        fileStatus.set(filePath, status as GitFileStatusCode);
      } else if (status === 'U') {
        fileStatus.set(filePath, 'U');
      } else {
        fileStatus.set(filePath, 'M');
      }
    }
  } catch {
    // Not a git repo or git command failed - return empty
  }

  return { fileStatus, untrackedDirs };
}
