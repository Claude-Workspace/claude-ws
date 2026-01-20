import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT = 10000;

// POST /api/git/branch - Create a new branch from a commit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath, branchName, startPoint, checkout } = body;

    if (!projectPath || !branchName) {
      return NextResponse.json(
        { error: 'projectPath and branchName are required' },
        { status: 400 }
      );
    }

    if (!startPoint) {
      return NextResponse.json(
        { error: 'startPoint (commit hash) is required' },
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

    // Validate branch name (git branch name rules)
    // Cannot begin with a dot, cannot contain .., ~, ^, :, ?, *, [, spaces, or @{
    if (!/^[a-zA-Z0-9/_\-][a-zA-Z0-9/_\-\.]*$/.test(branchName)) {
      return NextResponse.json(
        { error: 'Invalid branch name. Branch names can contain letters, numbers, hyphens, underscores, dots, and forward slashes, but cannot begin with a dot or contain consecutive dots.' },
        { status: 400 }
      );
    }

    // Validate startPoint (commit hash) format
    if (!/^[a-f0-9]{7,40}$/.test(startPoint)) {
      return NextResponse.json(
        { error: 'Invalid commit hash format' },
        { status: 400 }
      );
    }

    // Create the branch (and optionally checkout)
    let args: string[];
    if (checkout) {
      // Use checkout -b to create and checkout
      args = ['checkout', '-b', branchName, startPoint];
    } else {
      // Just create without checkout
      args = ['branch', branchName, startPoint];
    }

    const { stdout } = await execFileAsync('git', args, {
      cwd: resolvedPath,
      timeout: GIT_TIMEOUT,
    });

    // Get current HEAD and branch
    const { stdout: headOutput } = await execFileAsync(
      'git',
      ['rev-parse', 'HEAD'],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );

    const { stdout: branchOutput } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      }
    );

    const currentBranch = branchOutput.trim();
    const isDetached = currentBranch === 'HEAD';

    return NextResponse.json({
      success: true,
      message: checkout
        ? `Created and checked out new branch '${branchName}' from ${startPoint.slice(0, 7)}`
        : `Created new branch '${branchName}' from ${startPoint.slice(0, 7)}`,
      branchName,
      head: headOutput.trim(),
      ref: currentBranch,
      isDetached,
      isCheckedOut: checkout,
    });
  } catch (error: unknown) {
    console.error('Error creating branch:', error);
    const err = error as { message?: string; stderr?: string };

    // Check if branch already exists
    if (err.stderr?.includes('already exists')) {
      return NextResponse.json(
        { error: `Branch '${branchName}' already exists` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err.stderr || err.message || 'Failed to create branch' },
      { status: 500 }
    );
  }
}
