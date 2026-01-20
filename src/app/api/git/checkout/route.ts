import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT = 10000;

// POST /api/git/checkout - Checkout a commit (detached) or branch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath, commitish } = body;

    if (!projectPath || !commitish) {
      return NextResponse.json(
        { error: 'projectPath and commitish are required' },
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

    // Validate commitish format (basic check)
    if (!/^[a-zA-Z0-9/_\-.\s]+$/.test(commitish)) {
      return NextResponse.json(
        { error: 'Invalid commitish format' },
        { status: 400 }
      );
    }

    // Checkout the commit (will be in detached HEAD state if it's a commit hash)
    const { stdout } = await execFileAsync(
      'git',
      ['checkout', commitish],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );

    // Get current HEAD to return actual state
    const { stdout: headOutput } = await execFileAsync(
      'git',
      ['rev-parse', 'HEAD'],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );

    // Get current branch name (will be "HEAD" if detached)
    const { stdout: branchOutput } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );

    const isDetached = branchOutput.trim() === 'HEAD';

    return NextResponse.json({
      success: true,
      message: `Checked out ${commitish}${isDetached ? ' (detached HEAD)' : ''}`,
      head: headOutput.trim(),
      ref: branchOutput.trim(),
      isDetached,
    });
  } catch (error: unknown) {
    console.error('Error checking out:', error);
    const err = error as { message?: string; stderr?: string };

    return NextResponse.json(
      { error: err.stderr || err.message || 'Failed to checkout' },
      { status: 500 }
    );
  }
}
