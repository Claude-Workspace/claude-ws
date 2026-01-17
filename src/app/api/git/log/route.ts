import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT = 10000;

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  refs: string[];
  isLocal?: boolean;
  isMerge?: boolean;
}

async function getRemoteCommitHashes(cwd: string): Promise<Set<string>> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--remotes', '--format=%H'],
      { cwd, timeout: GIT_TIMEOUT }
    );
    return new Set(stdout.trim().split('\n').filter(Boolean));
  } catch (error) {
    console.error('Failed to get remote commits:', error);
    return new Set();
  }
}

// GET /api/git/log?path=/project/path&limit=50
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectPath = searchParams.get('path');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!projectPath) {
      return NextResponse.json(
        { error: 'path parameter is required' },
        { status: 400 }
      );
    }

    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
      return NextResponse.json(
        { error: 'Invalid project path' },
        { status: 400 }
      );
    }

    // Get git log with graph info
    // Format: hash|short_hash|subject|author|date|parents|refs
    const { stdout } = await execFileAsync(
      'git',
      [
        'log',
        '--all',
        `--max-count=${limit}`,
        '--format=%H|%h|%s|%an|%ar|%P|%D',
      ],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );

    const commits: GitCommit[] = [];
    const lines = stdout.trim().split('\n');

    // Get remote commit hashes for local detection
    const remoteHashes = await getRemoteCommitHashes(resolvedPath);

    for (const line of lines) {
      if (!line) continue;
      const [hash, shortHash, message, author, date, parents, refs] = line.split('|');

      const parentsList = parents ? parents.split(' ').filter(Boolean) : [];

      commits.push({
        hash,
        shortHash,
        message,
        author,
        date,
        parents: parentsList,
        refs: refs ? refs.split(', ').filter(Boolean) : [],
        isLocal: !remoteHashes.has(hash),
        isMerge: parentsList.length > 1,
      });
    }

    // Get current HEAD
    const { stdout: headOutput } = await execFileAsync(
      'git',
      ['rev-parse', 'HEAD'],
      { cwd: resolvedPath, timeout: GIT_TIMEOUT }
    );
    const head = headOutput.trim();

    return NextResponse.json({ commits, head });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };

    if (err.message?.includes('not a git repository')) {
      return NextResponse.json(
        { error: 'Not a git repository' },
        { status: 400 }
      );
    }

    console.error('Error getting git log:', error);
    return NextResponse.json(
      { error: 'Failed to get git log' },
      { status: 500 }
    );
  }
}
