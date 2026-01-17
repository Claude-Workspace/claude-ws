/**
 * Utility to add files from sidebar to chat attachments
 * Reads file content via API and converts to File blob for attachment store
 */

import { EXTENSION_MIME_MAP, MAX_FILE_SIZE } from './file-utils';
import { extname, basename } from 'path';

interface FileContentResponse {
  content: string | null;
  language: string | null;
  size: number;
  isBinary: boolean;
  mimeType: string;
}

/**
 * Add a file from the project filesystem to the attachment store
 * @param filePath - Relative path within the project
 * @param basePath - Project base path
 * @returns File object ready for attachment store
 */
export async function createFileFromPath(
  filePath: string,
  basePath: string
): Promise<File> {
  // Fetch file content from API
  const res = await fetch(
    `/api/files/content?basePath=${encodeURIComponent(basePath)}&path=${encodeURIComponent(filePath)}`
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to read file: ${res.statusText}`);
  }

  const data: FileContentResponse = await res.json();

  // Check if binary (images, PDFs, etc.)
  if (data.isBinary) {
    throw new Error('Binary files must be added via file picker or drag-drop');
  }

  // Check size limit
  if (data.size > MAX_FILE_SIZE) {
    throw new Error(
      `File too large: ${(data.size / 1024 / 1024).toFixed(1)}MB (max 10MB)`
    );
  }

  if (data.content === null) {
    throw new Error('Could not read file content');
  }

  // Determine MIME type
  const ext = extname(filePath).toLowerCase();
  const mimeType = EXTENSION_MIME_MAP[ext] || data.mimeType || 'text/plain';

  // Create File blob
  const blob = new Blob([data.content], { type: mimeType });
  const fileName = basename(filePath);
  const file = new File([blob], fileName, { type: mimeType });

  return file;
}

/**
 * Check if a file type is supported for context attachment
 */
export function isSupportedFileType(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();

  // Text-based files that can be added from sidebar
  const supportedExtensions = [
    '.ts', '.tsx', '.js', '.jsx',
    '.json', '.yaml', '.yml',
    '.md', '.txt',
    '.css', '.scss', '.less',
    '.html', '.xml', '.svg',
    '.py', '.rb', '.go', '.rs', '.java',
    '.c', '.cpp', '.h', '.hpp',
    '.sh', '.bash', '.zsh',
    '.sql', '.graphql',
    '.env', '.gitignore', '.dockerignore',
    '.toml', '.ini', '.cfg',
  ];

  return supportedExtensions.includes(ext);
}

/**
 * Get a human-readable file type label
 */
export function getFileTypeLabel(filePath: string): string {
  const ext = extname(filePath).toLowerCase();

  const labels: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript React',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript React',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.css': 'CSS',
    '.html': 'HTML',
  };

  return labels[ext] || ext.slice(1).toUpperCase();
}
