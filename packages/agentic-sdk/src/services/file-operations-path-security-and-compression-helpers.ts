/**
 * Path security validation and archive extraction helpers for file operations.
 * Provides home-directory boundary enforcement and zip/tar/gz decompression utilities.
 */
import path from 'path';
import os from 'os';
import { createReadStream, createWriteStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import AdmZip from 'adm-zip';
import * as tar from 'tar';

// ---------------------------------------------------------------------------
// Path security helpers
// ---------------------------------------------------------------------------

/** Resolve rootPath and assert it is within the user's home directory */
export function validateRootPath(rootPath: string): string {
  const resolved = path.resolve(rootPath);
  const home = os.homedir();
  if (!resolved.startsWith(home + path.sep) && resolved !== home) {
    throw new Error('Root path outside home directory');
  }
  return resolved;
}

/** Resolve targetPath and assert it does not escape allowedRoot */
export function validatePathWithinRoot(targetPath: string, allowedRoot: string): string {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(allowedRoot, resolved);
  if (relative.startsWith('..')) throw new Error('Path traversal detected');
  return resolved;
}

// ---------------------------------------------------------------------------
// Compression helpers
// ---------------------------------------------------------------------------

/** Return true when filename has a recognised archive extension */
export function isCompressedFile(filename: string): boolean {
  const ext = filename.toLowerCase();
  return (
    ext.endsWith('.zip') ||
    ext.endsWith('.tar') ||
    ext.endsWith('.tar.gz') ||
    ext.endsWith('.tgz') ||
    ext.endsWith('.gz')
  );
}

/** Extract an archive file into destDir; supports .zip, .tar, .tar.gz, .tgz, .gz */
export async function extractArchive(filePath: string, destDir: string, originalName: string): Promise<void> {
  const ext = originalName.toLowerCase();
  if (ext.endsWith('.zip')) {
    const zip = new AdmZip(filePath);
    const resolvedDest = path.resolve(destDir);
    for (const entry of zip.getEntries()) {
      const entryPath = path.resolve(destDir, entry.entryName);
      if (!entryPath.startsWith(resolvedDest + path.sep) && entryPath !== resolvedDest) {
        throw new Error(`Zip Slip detected: ${entry.entryName}`);
      }
    }
    zip.extractAllTo(destDir, true);
  } else if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz') || ext.endsWith('.tar')) {
    await tar.extract({ file: filePath, cwd: destDir });
  } else if (ext.endsWith('.gz')) {
    const outputName = originalName.replace(/\.gz$/i, '') || 'extracted';
    const outputPath = path.join(destDir, outputName);
    await pipeline(createReadStream(filePath), createGunzip(), createWriteStream(outputPath));
  }
}
