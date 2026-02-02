import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { createLogger } from '@/lib/logger';

const log = createLogger('FileUpload');

/**
 * Validate path stays within allowed root directory.
 * Prevents path traversal attacks like ../../../etc/passwd
 */
function validatePath(targetPath: string, allowedRoot: string): string {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(allowedRoot, resolved);

  if (relative.startsWith('..')) {
    throw new Error('Path traversal detected');
  }

  return resolved;
}

/**
 * Extract a .zip file to a directory
 */
async function extractZip(filePath: string, destDir: string): Promise<void> {
  const zip = new AdmZip(filePath);
  zip.extractAllTo(destDir, true);
}

/**
 * Extract a .tar, .tar.gz, .tgz file to a directory
 */
async function extractTar(filePath: string, destDir: string): Promise<void> {
  await tar.extract({
    file: filePath,
    cwd: destDir,
  });
}

/**
 * Extract a .gz file (non-tar) to a directory
 */
async function extractGzip(filePath: string, destDir: string, originalName: string): Promise<void> {
  // Remove .gz extension for output filename
  const outputName = originalName.replace(/\.gz$/i, '') || 'extracted';
  const outputPath = path.join(destDir, outputName);

  const gunzip = createGunzip();
  const source = createReadStream(filePath);
  const destination = createWriteStream(outputPath);

  await pipeline(source, gunzip, destination);
}

/**
 * Detect if a file is a compressed archive
 */
function isCompressedFile(filename: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith('.zip') ||
         ext.endsWith('.tar') ||
         ext.endsWith('.tar.gz') ||
         ext.endsWith('.tgz') ||
         ext.endsWith('.gz');
}

/**
 * Get the type of compression
 */
function getCompressionType(filename: string): 'zip' | 'tar' | 'gzip' | null {
  const ext = filename.toLowerCase();
  if (ext.endsWith('.zip')) return 'zip';
  if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz') || ext.endsWith('.tar')) return 'tar';
  if (ext.endsWith('.gz')) return 'gzip';
  return null;
}

/**
 * POST /api/files/upload
 *
 * Upload files to a directory in the project.
 * Supports optional decompression of archives.
 *
 * FormData:
 * - files: File[] - files to upload
 * - targetPath: string - directory to upload to
 * - rootPath: string - root path for validation
 * - decompress: 'true' | 'false' - whether to decompress archives
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const targetPath = formData.get('targetPath') as string;
    const rootPath = formData.get('rootPath') as string;
    const decompress = formData.get('decompress') === 'true';

    // Validate required fields
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (!targetPath || !rootPath) {
      return NextResponse.json(
        { error: 'targetPath and rootPath are required' },
        { status: 400 }
      );
    }

    // Security: Validate target path stays within root
    const resolvedTarget = validatePath(targetPath, rootPath);

    // Ensure target directory exists
    if (!fs.existsSync(resolvedTarget)) {
      return NextResponse.json(
        { error: 'Target directory not found' },
        { status: 404 }
      );
    }

    // Verify target is a directory
    const targetStats = await fs.promises.stat(resolvedTarget);
    if (!targetStats.isDirectory()) {
      return NextResponse.json(
        { error: 'Target path is not a directory' },
        { status: 400 }
      );
    }

    const results: { name: string; path: string; decompressed?: boolean }[] = [];
    const tempFiles: string[] = [];

    try {
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name.replace(/[/\\]/g, '_'); // Sanitize filename
        const filePath = path.join(resolvedTarget, filename);

        // Check if file already exists
        if (fs.existsSync(filePath)) {
          // Generate unique name
          const ext = path.extname(filename);
          const base = path.basename(filename, ext);
          let counter = 1;
          let newFilename = `${base}_${counter}${ext}`;
          let newPath = path.join(resolvedTarget, newFilename);

          while (fs.existsSync(newPath)) {
            counter++;
            newFilename = `${base}_${counter}${ext}`;
            newPath = path.join(resolvedTarget, newFilename);
          }

          await writeFile(newPath, buffer);

          // Handle decompression
          if (decompress && isCompressedFile(newFilename)) {
            tempFiles.push(newPath);
            const compressionType = getCompressionType(newFilename);

            try {
              if (compressionType === 'zip') {
                await extractZip(newPath, resolvedTarget);
              } else if (compressionType === 'tar') {
                await extractTar(newPath, resolvedTarget);
              } else if (compressionType === 'gzip') {
                await extractGzip(newPath, resolvedTarget, newFilename);
              }

              // Remove the archive after extraction
              await fs.promises.unlink(newPath);

              results.push({
                name: newFilename,
                path: resolvedTarget,
                decompressed: true,
              });
            } catch (extractError) {
              log.error({ error: extractError, filename: newFilename }, 'Failed to extract archive');
              // Keep the archive if extraction fails
              results.push({
                name: newFilename,
                path: newPath,
                decompressed: false,
              });
            }
          } else {
            results.push({
              name: newFilename,
              path: newPath,
            });
          }
        } else {
          await writeFile(filePath, buffer);

          // Handle decompression
          if (decompress && isCompressedFile(filename)) {
            tempFiles.push(filePath);
            const compressionType = getCompressionType(filename);

            try {
              if (compressionType === 'zip') {
                await extractZip(filePath, resolvedTarget);
              } else if (compressionType === 'tar') {
                await extractTar(filePath, resolvedTarget);
              } else if (compressionType === 'gzip') {
                await extractGzip(filePath, resolvedTarget, filename);
              }

              // Remove the archive after extraction
              await fs.promises.unlink(filePath);

              results.push({
                name: filename,
                path: resolvedTarget,
                decompressed: true,
              });
            } catch (extractError) {
              console.error(`Failed to extract ${filename}:`, extractError);
              // Keep the archive if extraction fails
              results.push({
                name: filename,
                path: filePath,
                decompressed: false,
              });
            }
          } else {
            results.push({
              name: filename,
              path: filePath,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        files: results,
      });
    } catch (error) {
      // Cleanup temp files on error
      for (const tempFile of tempFiles) {
        try {
          if (fs.existsSync(tempFile)) {
            await fs.promises.unlink(tempFile);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'Path traversal detected') {
        return NextResponse.json(
          { error: 'Invalid path' },
          { status: 403 }
        );
      }

      if ('code' in error && error.code === 'EACCES') {
        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    log.error({ error }, 'Upload error');
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}
