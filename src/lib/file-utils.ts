import { join, extname } from 'path';

// Allowed MIME types for upload
export const ALLOWED_TYPES = [
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  // Code files
  'text/x-typescript',
  'text/typescript',
  'application/typescript',
  'text/javascript',
  'application/javascript',
  'application/json',
  'text/css',
  'text/html',
  'text/xml',
  'application/xml',
];

// File extension to MIME type mapping for detection
export const EXTENSION_MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.html': 'text/html',
  '.xml': 'application/xml',
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB per attempt

export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const TEMP_DIR = join(process.cwd(), 'uploads', 'temp');

// Validate file type and size
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check MIME type
  const ext = extname(file.name).toLowerCase();
  const expectedMime = EXTENSION_MIME_MAP[ext];

  // Allow if MIME matches expected for extension, or is in allowed list
  if (!expectedMime && !ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type: ${file.type}` };
  }

  // Check size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 10MB)`,
    };
  }

  return { valid: true };
}

// Sanitize filename to prevent path traversal
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/\.{2,}/g, '.') // No double dots
    .slice(0, 100);
}

// Get file extension from filename
export function getExtension(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

// Get MIME type from filename
export function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
}

// Check if file is an image
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
