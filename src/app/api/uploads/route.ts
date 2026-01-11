import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { nanoid } from 'nanoid';
import {
  validateFile,
  sanitizeFilename,
  getExtension,
  TEMP_DIR,
  MAX_TOTAL_SIZE,
} from '@/lib/file-utils';

// POST /api/uploads - Upload files to temp storage
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Check total size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: `Total size exceeds 50MB limit` },
        { status: 400 }
      );
    }

    // Ensure temp directory exists
    await mkdir(TEMP_DIR, { recursive: true });

    const results = [];

    for (const file of files) {
      // Validate
      const validation = validateFile(file);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      // Generate temp ID and filename
      const tempId = nanoid();
      const safeName = sanitizeFilename(file.name);
      const ext = getExtension(safeName);
      const filename = `${tempId}-${Date.now()}${ext ? `.${ext}` : ''}`;

      // Write to temp directory
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = join(TEMP_DIR, filename);
      await writeFile(filePath, buffer);

      results.push({
        tempId,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
      });
    }

    return NextResponse.json({ files: results }, { status: 201 });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}
