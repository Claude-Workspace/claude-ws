import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// GET /api/files/metadata?path=xxx&basePath=xxx
// Lightweight endpoint that returns only file metadata (mtime, size) without reading content
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');
    const basePath = searchParams.get('basePath');

    if (!filePath || !basePath) {
      return NextResponse.json(
        { error: 'path and basePath parameters are required' },
        { status: 400 }
      );
    }

    const fullPath = path.resolve(basePath, filePath);
    const normalizedBase = path.resolve(basePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(normalizedBase)) {
      return NextResponse.json(
        { error: 'Invalid path: directory traversal detected' },
        { status: 403 }
      );
    }

    // Check file exists
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stats = fs.statSync(fullPath);

    // Check it's a file
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'Path is not a file' }, { status: 400 });
    }

    return NextResponse.json({
      mtime: stats.mtimeMs,
      size: stats.size,
    });
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return NextResponse.json(
      { error: 'Failed to get file metadata' },
      { status: 500 }
    );
  }
}
