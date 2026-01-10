import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT = 5000;

// POST /api/git/discard - Discard changes
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

    if (all) {
      // Discard all changes: git checkout -- . && git clean -fd
      await execFileAsync('git', ['checkout', '--', '.'], {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      });
      await execFileAsync('git', ['clean', '-fd'], {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      });
    } else if (Array.isArray(files) && files.length > 0) {
      // Validate and categorize files
      for (const file of files) {
        const resolvedFile = path.resolve(resolvedPath, file);
        if (!resolvedFile.startsWith(resolvedPath)) {
          return NextResponse.json(
            { error: 'Invalid file path' },
            { status: 403 }
          );
        }
      }

      // For tracked files: git checkout -- file
      // For untracked files: rm file
      for (const file of files) {
        try {
          // Try git checkout first (for tracked files)
          await execFileAsync('git', ['checkout', '--', file], {
            cwd: resolvedPath,
            timeout: GIT_TIMEOUT,
          });
        } catch {
          // If checkout fails, file might be untracked - try to remove it
          const fullPath = path.join(resolvedPath, file);
          if (fs.existsSync(fullPath)) {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              fs.rmSync(fullPath, { recursive: true });
            } else {
              fs.unlinkSync(fullPath);
            }
          }
        }
      }
    } else {
      return NextResponse.json(
        { error: 'files array or all flag is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error discarding changes:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || 'Failed to discard changes' },
      { status: 500 }
    );
  }
}
