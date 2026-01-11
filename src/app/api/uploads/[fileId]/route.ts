import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir, unlink, stat } from 'fs/promises';
import { join, basename } from 'path';
import { TEMP_DIR, UPLOADS_DIR, getMimeType } from '@/lib/file-utils';

// Find file by tempId prefix in temp or attempt directories
async function findFile(
  fileId: string
): Promise<{ path: string; filename: string } | null> {
  // Check temp directory first
  try {
    const tempFiles = await readdir(TEMP_DIR);
    const tempFile = tempFiles.find((f) => f.startsWith(fileId));
    if (tempFile) {
      return { path: join(TEMP_DIR, tempFile), filename: tempFile };
    }
  } catch {
    // Temp dir may not exist
  }

  // Check attempt directories
  try {
    const attemptDirs = await readdir(UPLOADS_DIR);
    for (const dir of attemptDirs) {
      if (dir === 'temp') continue;
      const attemptPath = join(UPLOADS_DIR, dir);
      const dirStat = await stat(attemptPath);
      if (!dirStat.isDirectory()) continue;

      const files = await readdir(attemptPath);
      const file = files.find((f) => f.startsWith(fileId));
      if (file) {
        return { path: join(attemptPath, file), filename: file };
      }
    }
  } catch {
    // Uploads dir may not exist
  }

  return null;
}

// GET /api/uploads/[fileId] - Serve file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    // Validate fileId format (nanoid pattern)
    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const found = await findFile(fileId);
    if (!found) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const buffer = await readFile(found.path);
    const mimeType = getMimeType(found.filename);

    return new Response(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${basename(found.filename)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Failed to serve file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}

// DELETE /api/uploads/[fileId] - Remove pending (temp) file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    // Validate fileId format
    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Only allow deleting temp files (pending uploads)
    const tempFiles = await readdir(TEMP_DIR);
    const tempFile = tempFiles.find((f) => f.startsWith(fileId));

    if (!tempFile) {
      return NextResponse.json(
        { error: 'Temp file not found' },
        { status: 404 }
      );
    }

    await unlink(join(TEMP_DIR, tempFile));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
