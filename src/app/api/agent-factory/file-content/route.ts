import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

interface FileContentRequest {
  basePath: string;
  filePath: string;
}

// POST /api/agent-factory/file-content - Read file content from source path (for discovered components)
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json() as FileContentRequest;
    const { basePath, filePath } = body;

    if (!basePath || !filePath) {
      return NextResponse.json({ error: 'Missing basePath or filePath' }, { status: 400 });
    }

    // Build full file path
    // For single-file components (agents/commands), basePath is the file itself
    // For directories (skills), basePath is the directory and filePath is relative
    let fullPath: string;
    if (existsSync(basePath) && (await stat(basePath)).isFile()) {
      // basePath is a file - use it directly
      fullPath = basePath;
    } else {
      // basePath is a directory - join with filePath
      fullPath = join(basePath, filePath);
    }

    // Security check: only allow paths from ~/.claude
    const resolvedPath = require('path').resolve(fullPath);
    if (!resolvedPath.startsWith(homedir())) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      return NextResponse.json({ error: 'Is a directory' }, { status: 400 });
    }

    const content = await readFile(fullPath, 'utf-8');

    // Detect language from file extension
    const ext = filePath.split('.').pop() || '';
    const language = getLanguageFromExtension(ext);

    return NextResponse.json({
      name: filePath.split('/').pop() || filePath,
      path: filePath,
      content,
      language,
      size: stats.size,
    });
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}

function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'sql': 'sql',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'md': 'markdown',
    'markdown': 'markdown',
    'txt': 'text',
    'toml': 'toml',
    'ini': 'ini',
    'cfg': 'ini',
    'dockerfile': 'dockerfile',
    'docker': 'dockerfile',
    'makefile': 'makefile',
    'cmake': 'cmake',
  };
  return langMap[ext.toLowerCase()] || 'text';
}
