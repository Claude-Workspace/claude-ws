import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Language mapping by extension (must match CodeMirror language keys)
const LANGUAGE_MAP: Record<string, string | null> = {
  // JavaScript/TypeScript
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  // Data
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.toml': null, // Not supported
  // Config
  '.env': null,
  '.gitignore': null,
  '.dockerignore': null,
  // Markdown
  '.md': 'markdown',
  '.mdx': 'markdown',
  // Shell (not supported in CodeMirror, will be plain text)
  '.sh': null,
  '.bash': null,
  '.zsh': null,
  // Python
  '.py': 'python',
  // Go (not supported)
  '.go': null,
  // Rust
  '.rs': 'rust',
  // SQL
  '.sql': 'sql',
  // PHP
  '.php': 'php',
  // Java
  '.java': 'java',
  // C/C++
  '.c': 'cpp',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.h': 'cpp',
  '.hpp': 'cpp',
  // Others
  '.txt': null,
  '.log': null,
};

// Binary file extensions (don't try to read as text)
const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.zip', '.tar', '.gz', '.rar',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
];

// GET /api/files/content?path=xxx&basePath=xxx
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

    // Construct full path and validate it's within basePath
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

    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large', size: stats.size, maxSize: MAX_FILE_SIZE },
        { status: 413 }
      );
    }

    const ext = path.extname(fullPath).toLowerCase();

    // Check if binary
    if (BINARY_EXTENSIONS.includes(ext)) {
      return NextResponse.json({
        content: null,
        language: null,
        size: stats.size,
        isBinary: true,
        mimeType: getMimeType(ext),
      });
    }

    // Read file content
    const content = fs.readFileSync(fullPath, 'utf-8');
    const language = LANGUAGE_MAP[ext] || detectLanguage(fullPath);

    return NextResponse.json({
      content,
      language,
      size: stats.size,
      isBinary: false,
      mimeType: getMimeType(ext),
    });
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function detectLanguage(filePath: string): string | null {
  const fileName = path.basename(filePath);

  // Special file names
  const specialFiles: Record<string, string | null> = {
    'Dockerfile': null,
    'Makefile': null,
    '.eslintrc': 'json',
    '.prettierrc': 'json',
    'tsconfig.json': 'json',
    'package.json': 'json',
  };

  if (specialFiles[fileName] !== undefined) {
    return specialFiles[fileName];
  }

  return null;
}

// POST /api/files/content - Save file content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { basePath, path: filePath, content } = body;

    // Validate required fields
    if (!filePath || !basePath || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'basePath, path, and content are required' },
        { status: 400 }
      );
    }

    // Construct full path and validate within basePath
    const fullPath = path.resolve(basePath, filePath);
    const normalizedBase = path.resolve(basePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(normalizedBase)) {
      return NextResponse.json(
        { error: 'Invalid path: directory traversal detected' },
        { status: 403 }
      );
    }

    // Check file exists (no creating new files via this endpoint)
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const stats = fs.statSync(fullPath);

    // Check it's a file
    if (!stats.isFile()) {
      return NextResponse.json(
        { error: 'Path is not a file' },
        { status: 400 }
      );
    }

    const ext = path.extname(fullPath).toLowerCase();

    // Prevent writing to binary files
    if (BINARY_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: 'Cannot write to binary files' },
        { status: 400 }
      );
    }

    // Write file content
    fs.writeFileSync(fullPath, content, 'utf-8');

    // Get new file stats
    const newStats = fs.statSync(fullPath);

    return NextResponse.json({
      success: true,
      size: newStats.size,
    });
  } catch (error) {
    console.error('Error writing file:', error);
    return NextResponse.json(
      { error: 'Failed to write file' },
      { status: 500 }
    );
  }
}
