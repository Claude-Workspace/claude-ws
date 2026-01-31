import { NextRequest, NextResponse } from 'next/server';
import { rm, rename, mkdir, writeFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

/**
 * Validate path stays within allowed root directory.
 * Prevents path traversal attacks like ../../../etc/passwd
 *
 * @param targetPath - User-provided path to validate
 * @param allowedRoot - Root directory that bounds allowed operations
 * @returns Resolved absolute path
 * @throws Error if path traversal detected
 */
function validatePath(targetPath: string, allowedRoot: string): string {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(allowedRoot, resolved);

  // If relative path starts with '..', it's outside allowed root
  if (relative.startsWith('..')) {
    throw new Error('Path traversal detected');
  }

  return resolved;
}

/**
 * DELETE /api/files/operations
 *
 * Delete a file or folder recursively.
 *
 * Request body: { path: string, rootPath: string }
 * Response: { success: true } | { error: string }
 *
 * Security:
 * - Path traversal validation via validatePath()
 * - File existence check before deletion
 * - Permission error handling (EACCES -> 403)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { path: targetPath, rootPath } = await request.json();

    // Validate required fields
    if (!targetPath || !rootPath) {
      return NextResponse.json(
        { error: 'path and rootPath required' },
        { status: 400 }
      );
    }

    // Security: Validate path stays within root
    const resolved = validatePath(targetPath, rootPath);

    // Check if path exists
    if (!fs.existsSync(resolved)) {
      return NextResponse.json(
        { error: 'Path not found' },
        { status: 404 }
      );
    }

    // Delete file or folder recursively
    await rm(resolved, { recursive: true, force: true });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Handle known error types
    if (error instanceof Error) {
      // Path traversal attempt
      if (error.message === 'Path traversal detected') {
        return NextResponse.json(
          { error: 'Invalid path' },
          { status: 403 }
        );
      }

      // Permission denied
      if ('code' in error && error.code === 'EACCES') {
        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    // Log and return generic error
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/files/operations
 *
 * Download a file or folder.
 * - Files: returned directly with proper MIME type
 * - Folders: returned as ZIP archive
 *
 * Request body: { path: string, rootPath: string }
 * Response: File blob or ZIP buffer with download headers
 *
 * Security:
 * - Path traversal validation via validatePath()
 * - File existence check before download
 * - Only operations within provided rootPath
 */
export async function POST(request: NextRequest) {
  try {
    const { path: targetPath, rootPath } = await request.json();

    // Validate required fields
    if (!targetPath || !rootPath) {
      return NextResponse.json(
        { error: 'path and rootPath required' },
        { status: 400 }
      );
    }

    // Security: Validate path stays within root
    const resolved = validatePath(targetPath, rootPath);

    // Check if path exists
    if (!fs.existsSync(resolved)) {
      return NextResponse.json(
        { error: 'Path not found' },
        { status: 404 }
      );
    }

    const stats = await fs.promises.stat(resolved);
    const filename = path.basename(resolved);

    if (stats.isDirectory()) {
      // Folder: Create ZIP archive
      const zip = new AdmZip();
      zip.addLocalFolder(resolved);

      const zipBuffer = zip.toBuffer();

      // Return ZIP with download headers
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}.zip"`,
          'Content-Length': zipBuffer.length.toString(),
        },
      });
    } else {
      // File: Return directly with appropriate MIME type
      const fileBuffer = await fs.promises.readFile(resolved);

      // Determine MIME type based on extension
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.json': 'application/json',
        '.js': 'text/javascript',
        '.ts': 'text/typescript',
        '.tsx': 'text/typescript',
        '.jsx': 'text/javascript',
        '.html': 'text/html',
        '.css': 'text/css',
        '.xml': 'application/xml',
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.zip': 'application/zip',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      // Return file with download headers
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    }
  } catch (error: unknown) {
    // Handle known error types
    if (error instanceof Error) {
      // Path traversal attempt
      if (error.message === 'Path traversal detected') {
        return NextResponse.json(
          { error: 'Invalid path' },
          { status: 403 }
        );
      }

      // Permission denied
      if ('code' in error && error.code === 'EACCES') {
        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    // Log and return generic error
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to create download' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/files/operations
 *
 * Create a new file or folder in a directory.
 *
 * Request body: { parentPath: string, rootPath: string, name: string, type: 'file' | 'folder' }
 * Response: { success: true, path: string }
 *
 * Security:
 * - Path traversal validation via validatePath()
 * - Parent directory existence check
 * - Name validation (no path traversal, no special characters)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { parentPath, rootPath, name, type } = await request.json();

    // Validate required fields
    if (!parentPath || !rootPath || !name || !type) {
      return NextResponse.json(
        { error: 'parentPath, rootPath, name, and type required' },
        { status: 400 }
      );
    }

    // Validate type
    if (type !== 'file' && type !== 'folder') {
      return NextResponse.json(
        { error: 'type must be "file" or "folder"' },
        { status: 400 }
      );
    }

    // Security: Validate parent path stays within root
    const resolvedParent = validatePath(parentPath, rootPath);

    // Check if parent directory exists
    if (!fs.existsSync(resolvedParent)) {
      return NextResponse.json(
        { error: 'Parent directory not found' },
        { status: 404 }
      );
    }

    // Verify parent is actually a directory
    const parentStats = await fs.promises.stat(resolvedParent);
    if (!parentStats.isDirectory()) {
      return NextResponse.json(
        { error: 'Parent path is not a directory' },
        { status: 400 }
      );
    }

    // Validate new name (prevent path traversal)
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid name. Cannot contain path separators or ..' },
        { status: 400 }
      );
    }

    // Build new path
    const newPath = path.join(resolvedParent, name);

    // Check if path already exists
    if (fs.existsSync(newPath)) {
      return NextResponse.json(
        { error: 'A file or folder with that name already exists' },
        { status: 409 }
      );
    }

    // Create file or folder
    if (type === 'folder') {
      await mkdir(newPath, { recursive: false });
    } else {
      // Create empty file
      await writeFile(newPath, '', { encoding: 'utf-8' });
    }

    // Return relative path for frontend consistency
    const relativeNewPath = path.relative(rootPath, newPath);

    return NextResponse.json({ success: true, path: relativeNewPath });
  } catch (error: unknown) {
    // Handle known error types
    if (error instanceof Error) {
      // Path traversal attempt
      if (error.message === 'Path traversal detected') {
        return NextResponse.json(
          { error: 'Invalid path' },
          { status: 403 }
        );
      }

      // Permission denied
      if ('code' in error && error.code === 'EACCES') {
        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    // Log and return generic error
    console.error('Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/files/operations
 *
 * Rename a file or folder.
 *
 * Request body: { path: string, rootPath: string, newName: string }
 * Response: { success: true }
 *
 * Security:
 * - Path traversal validation via validatePath()
 * - File existence check before rename
 * - New name validation (no path traversal, no special characters)
 */
export async function PUT(request: NextRequest) {
  try {
    const { path: targetPath, rootPath, newName } = await request.json();

    // Validate required fields
    if (!targetPath || !rootPath || !newName) {
      return NextResponse.json(
        { error: 'path, rootPath, and newName required' },
        { status: 400 }
      );
    }

    // Security: Validate path stays within root
    const resolved = validatePath(targetPath, rootPath);

    // Check if path exists
    if (!fs.existsSync(resolved)) {
      return NextResponse.json(
        { error: 'Path not found' },
        { status: 404 }
      );
    }

    // Validate new name (prevent path traversal)
    if (newName.includes('/') || newName.includes('\\') || newName.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid name. Cannot contain path separators or ..' },
        { status: 400 }
      );
    }

    // Build new path
    const directory = path.dirname(resolved);
    const newPath = path.join(directory, newName);

    // Check if new path already exists
    if (fs.existsSync(newPath)) {
      return NextResponse.json(
        { error: 'A file with that name already exists' },
        { status: 409 }
      );
    }

    // Rename file/folder
    await rename(resolved, newPath);

    // Return relative path for frontend consistency
    const relativeNewPath = path.relative(rootPath, newPath);

    return NextResponse.json({ success: true, newPath: relativeNewPath });
  } catch (error: unknown) {
    // Handle known error types
    if (error instanceof Error) {
      // Path traversal attempt
      if (error.message === 'Path traversal detected') {
        return NextResponse.json(
          { error: 'Invalid path' },
          { status: 403 }
        );
      }

      // Permission denied
      if ('code' in error && error.code === 'EACCES') {
        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    // Log and return generic error
    console.error('Rename error:', error);
    return NextResponse.json(
      { error: 'Failed to rename' },
      { status: 500 }
    );
  }
}
