import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT = 5000;

// POST /api/git/stage - Stage file(s)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath, files, all } = body;

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

    const args = ['add'];
    if (all) {
      args.push('-A');
    } else if (Array.isArray(files) && files.length > 0) {
      // Validate file paths
      for (const file of files) {
        const resolvedFile = path.resolve(resolvedPath, file);
        if (!resolvedFile.startsWith(resolvedPath)) {
          return NextResponse.json(
            { error: 'Invalid file path' },
            { status: 403 }
          );
        }
      }
      args.push('--', ...files);
    } else {
      return NextResponse.json(
        { error: 'files array or all flag is required' },
        { status: 400 }
      );
    }

    await execFileAsync('git', args, {
      cwd: resolvedPath,
      timeout: GIT_TIMEOUT,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error staging files:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || 'Failed to stage files' },
      { status: 500 }
    );
  }
}

// DELETE /api/git/stage - Unstage file(s)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath, files, all } = body;

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

    const args = ['reset', 'HEAD'];
    if (all) {
      // Reset all staged files
    } else if (Array.isArray(files) && files.length > 0) {
      args.push('--', ...files);
    } else {
      return NextResponse.json(
        { error: 'files array or all flag is required' },
        { status: 400 }
      );
    }

    await execFileAsync('git', args, {
      cwd: resolvedPath,
      timeout: GIT_TIMEOUT,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error unstaging files:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || 'Failed to unstage files' },
      { status: 500 }
    );
  }
}
