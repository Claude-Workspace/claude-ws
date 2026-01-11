import { mkdir, rename, readdir, stat, unlink } from 'fs/promises';
import { join, extname } from 'path';
import { nanoid } from 'nanoid';
import { db, schema } from './db';
import { TEMP_DIR, UPLOADS_DIR, getMimeType } from './file-utils';

export interface ProcessedFile {
  id: string;
  filename: string;
  originalName: string;
  absolutePath: string;
  mimeType: string;
  size: number;
}

// Process temp files and move them to attempt directory
export async function processAttachments(
  attemptId: string,
  tempIds: string[]
): Promise<ProcessedFile[]> {
  if (tempIds.length === 0) return [];

  const attemptDir = join(UPLOADS_DIR, attemptId);
  await mkdir(attemptDir, { recursive: true });

  const results: ProcessedFile[] = [];

  for (const tempId of tempIds) {
    try {
      // Find temp file by ID prefix
      const tempFiles = await readdir(TEMP_DIR);
      const tempFile = tempFiles.find((f) => f.startsWith(tempId));

      if (!tempFile) {
        console.warn(`Temp file not found: ${tempId}`);
        continue;
      }

      const tempPath = join(TEMP_DIR, tempFile);
      const fileId = nanoid();
      const ext = extname(tempFile);
      const newFilename = `${fileId}${ext}`;
      const newPath = join(attemptDir, newFilename);

      // Move file from temp to attempt directory
      await rename(tempPath, newPath);

      // Get file info
      const stats = await stat(newPath);
      const mimeType = getMimeType(newFilename);

      // Extract original name from temp filename
      // Pattern: {tempId}-{timestamp}.{ext}
      const originalName = extractOriginalName(tempFile, ext);

      // Insert DB record
      await db.insert(schema.attemptFiles).values({
        id: fileId,
        attemptId,
        filename: newFilename,
        originalName,
        mimeType,
        size: stats.size,
      });

      results.push({
        id: fileId,
        filename: newFilename,
        originalName,
        absolutePath: newPath,
        mimeType,
        size: stats.size,
      });

      console.log(`Processed file: ${tempId} -> ${newFilename}`);
    } catch (error) {
      console.error(`Failed to process temp file ${tempId}:`, error);
    }
  }

  return results;
}

// Extract a reasonable original name from temp filename
function extractOriginalName(tempFilename: string, ext: string): string {
  // Pattern: {tempId}-{timestamp}{ext}
  // Just use the extension with "attachment" prefix
  const extClean = ext.startsWith('.') ? ext.slice(1) : ext;
  return extClean ? `attachment.${extClean}` : 'attachment';
}

// Cleanup orphaned temp files older than 1 hour
export async function cleanupOrphanedTempFiles(): Promise<number> {
  try {
    const tempFiles = await readdir(TEMP_DIR);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleaned = 0;

    for (const file of tempFiles) {
      try {
        const filePath = join(TEMP_DIR, file);
        const stats = await stat(filePath);

        if (stats.mtimeMs < oneHourAgo) {
          await unlink(filePath);
          cleaned++;
          console.log(`Cleaned up orphaned temp file: ${file}`);
        }
      } catch (error) {
        console.error(`Failed to cleanup temp file ${file}:`, error);
      }
    }

    return cleaned;
  } catch (error) {
    console.error('Failed to cleanup orphaned temp files:', error);
    return 0;
  }
}
