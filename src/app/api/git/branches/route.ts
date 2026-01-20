import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT = 10000;

// GET /api/git/branches - List all local and remote branches
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectPath = searchParams.get('path');

    if (!projectPath) {
      return NextResponse.json(
        { error: 'projectPath is required' },
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

    // Get current branch
    const { stdout: currentBranchOutput } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );
    const currentBranch = currentBranchOutput.trim();

    // Get all local branches
    const { stdout: localBranchesOutput } = await execFileAsync(
      'git',
      ['branch', '--format', '%(refname:short)|%(HEAD)|%(upstream:short)'],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );

    // Get remote branches
    const { stdout: remoteBranchesOutput } = await execFileAsync(
      'git',
      ['branch', '--remote', '--format', '%(refname:short)'],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );

    // Parse local branches
    const localBranches = localBranchesOutput
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name, isHead, upstream] = line.split('|');
        return {
          name,
          isCurrent: isHead === '*',
          upstream: upstream || null,
          type: 'local' as const,
        };
      });

    // Parse remote branches (filter out HEAD pointers)
    const remoteBranches = remoteBranchesOutput
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.endsWith('/HEAD'))
      .map((name) => ({
        name,
        isCurrent: false,
        upstream: null,
        type: 'remote' as const,
      }));

    return NextResponse.json({
      currentBranch,
      localBranches,
      remoteBranches,
    });
  } catch (error: unknown) {
    console.error('Error listing branches:', error);
    const err = error as { message?: string; stderr?: string };

    return NextResponse.json(
      { error: err.stderr || err.message || 'Failed to list branches' },
      { status: 500 }
    );
  }
}
