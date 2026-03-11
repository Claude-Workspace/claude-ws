/**
 * File operations and upload service - delete, download, create, rename, upload files/folders.
 * Delegates path security and compression to dedicated helper modules.
 * Self-contained: no Next.js or @/ imports.
 */
import fs from 'fs';
import path from 'path';
import { rm, rename, mkdir, writeFile, readFile } from 'fs/promises';
import AdmZip from 'adm-zip';
import { getContentTypeForExtension } from './file-tree-and-content-service';
import {
  validateRootPath,
  validatePathWithinRoot,
  isCompressedFile,
  extractArchive,
} from './file-operations-path-security-and-compression-helpers.ts';

export function createFileOperationsService() {
  return {
    /**
     * Delete a file or directory recursively.
     * Throws if path doesn't exist or traversal detected.
     */
    async deleteFileOrDir(targetPath: string, rootPath: string): Promise<void> {
      validateRootPath(rootPath);
      const resolved = validatePathWithinRoot(targetPath, rootPath);
      if (!fs.existsSync(resolved)) throw new Error('Path not found');
      await rm(resolved, { recursive: true, force: true });
    },

    /**
     * Download a file (returns buffer+mime) or directory (returns ZIP buffer).
     * Throws if path doesn't exist or traversal detected.
     */
    async downloadFileOrDir(
      targetPath: string,
      rootPath: string
    ): Promise<{ buffer: Uint8Array; filename: string; contentType: string; isZip: boolean }> {
      validateRootPath(rootPath);
      const resolved = validatePathWithinRoot(targetPath, rootPath);
      if (!fs.existsSync(resolved)) throw new Error('Path not found');
      const stats = fs.statSync(resolved);
      const filename = path.basename(resolved);

      if (stats.isDirectory()) {
        const zip = new AdmZip();
        zip.addLocalFolder(resolved);
        return {
          buffer: new Uint8Array(zip.toBuffer()),
          filename: `${filename}.zip`,
          contentType: 'application/zip',
          isZip: true,
        };
      }

      const fileBuffer = await readFile(resolved);
      const ext = path.extname(filename).toLowerCase();
      return {
        buffer: new Uint8Array(fileBuffer),
        filename,
        contentType: getContentTypeForExtension(ext),
        isZip: false,
      };
    },

    /**
     * Create a new file or directory inside parentPath.
     * Throws on invalid name, missing parent, or existing path.
     */
    async createFileOrDir(
      parentPath: string,
      rootPath: string,
      name: string,
      type: 'file' | 'folder'
    ): Promise<string> {
      validateRootPath(rootPath);
      const resolvedParent = validatePathWithinRoot(parentPath, rootPath);
      if (!fs.existsSync(resolvedParent)) throw new Error('Parent directory not found');
      const parentStats = fs.statSync(resolvedParent);
      if (!parentStats.isDirectory()) throw new Error('Parent path is not a directory');
      if (name.includes('/') || name.includes('\\') || name.includes('..')) {
        throw new Error('Invalid name');
      }
      const newPath = path.join(resolvedParent, name);
      if (fs.existsSync(newPath)) throw new Error('Already exists');
      if (type === 'folder') {
        await mkdir(newPath, { recursive: false });
      } else {
        await writeFile(newPath, '', { encoding: 'utf-8' });
      }
      return newPath;
    },

    /**
     * Rename a file or directory in-place.
     * Throws on invalid name, missing path, or existing target.
     */
    async renameFileOrDir(targetPath: string, rootPath: string, newName: string): Promise<string> {
      validateRootPath(rootPath);
      const resolved = validatePathWithinRoot(targetPath, rootPath);
      if (!fs.existsSync(resolved)) throw new Error('Path not found');
      if (newName.includes('/') || newName.includes('\\') || newName.includes('..')) {
        throw new Error('Invalid name');
      }
      const directory = path.dirname(resolved);
      const newPath = path.join(directory, newName);
      if (fs.existsSync(newPath)) throw new Error('Already exists');
      await rename(resolved, newPath);
      return newPath;
    },

    /**
     * Upload files to a target directory with optional archive extraction.
     * Handles duplicate filenames automatically.
     */
    async uploadFiles(
      targetPath: string,
      rootPath: string,
      files: Array<{ name: string; buffer: Buffer }>,
      decompress: boolean
    ): Promise<Array<{ name: string; path: string; decompressed?: boolean }>> {
      validateRootPath(rootPath);
      const resolvedTarget = validatePathWithinRoot(targetPath, rootPath);
      if (!fs.existsSync(resolvedTarget)) throw new Error('Target directory not found');
      const targetStats = fs.statSync(resolvedTarget);
      if (!targetStats.isDirectory()) throw new Error('Target path is not a directory');

      const results: Array<{ name: string; path: string; decompressed?: boolean }> = [];

      for (const file of files) {
        const filename = file.name.replace(/[/\\]/g, '_');
        let filePath = path.join(resolvedTarget, filename);

        // Handle duplicate filenames
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filename);
          const base = path.basename(filename, ext);
          let counter = 1;
          while (fs.existsSync(path.join(resolvedTarget, `${base}_${counter}${ext}`))) counter++;
          filePath = path.join(resolvedTarget, `${base}_${counter}${ext}`);
        }

        await writeFile(filePath, file.buffer);
        const actualFilename = path.basename(filePath);

        if (decompress && isCompressedFile(actualFilename)) {
          try {
            await extractArchive(filePath, resolvedTarget, actualFilename);
            await rm(filePath);
            results.push({ name: actualFilename, path: resolvedTarget, decompressed: true });
          } catch {
            results.push({ name: actualFilename, path: filePath, decompressed: false });
          }
        } else {
          results.push({ name: actualFilename, path: filePath });
        }
      }
      return results;
    },

    /**
     * Get file metadata (mtime, size) with path traversal protection.
     */
    getMetadata(basePath: string, filePath: string): { mtime: number; size: number } {
      const fullPath = path.resolve(basePath, filePath);
      const normalizedBase = path.resolve(basePath);
      if (!fullPath.startsWith(normalizedBase)) throw new Error('Path traversal detected');
      if (!fs.existsSync(fullPath)) throw new Error('File not found');
      const stats = fs.statSync(fullPath);
      if (!stats.isFile()) throw new Error('Path is not a file');
      return { mtime: stats.mtimeMs, size: stats.size };
    },
  };
}
