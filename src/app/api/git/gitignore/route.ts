import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// POST /api/git/gitignore - Add file to .gitignore
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath, filePath } = body;

    if (!projectPath) {
      return NextResponse.json(
        { error: 'projectPath is required' },
        { status: 400 }
      );
    }

    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath is required' },
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

    // Validate file path is within project
    const resolvedFile = path.resolve(resolvedPath, filePath);
    if (!resolvedFile.startsWith(resolvedPath)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    const gitignorePath = path.join(resolvedPath, '.gitignore');

    // Read existing .gitignore or create empty content
    let gitignoreContent = '';
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    }

    // Normalize the file path for gitignore (use forward slashes)
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Check if file is already in .gitignore
    const lines = gitignoreContent.split('\n');
    const alreadyIgnored = lines.some((line) => {
      const trimmed = line.trim();
      return trimmed === normalizedPath || trimmed === `/${normalizedPath}`;
    });

    if (alreadyIgnored) {
      return NextResponse.json({ success: true, alreadyIgnored: true });
    }

    // Add file to .gitignore
    const newEntry = normalizedPath;
    const newContent = gitignoreContent.endsWith('\n') || gitignoreContent === ''
      ? `${gitignoreContent}${newEntry}\n`
      : `${gitignoreContent}\n${newEntry}\n`;

    fs.writeFileSync(gitignorePath, newContent, 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error adding to .gitignore:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || 'Failed to add to .gitignore' },
      { status: 500 }
    );
  }
}
