import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FilesRequest {
  sourcePath: string;
  type: 'skill' | 'command' | 'agent';
}

// POST /api/agent-factory/files - List files from source path (for discovered components)
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json() as FilesRequest;
    const { sourcePath, type } = body;

    if (!sourcePath || !type) {
      return NextResponse.json({ error: 'Missing sourcePath or type' }, { status: 400 });
    }

    // Security check: only allow paths from ~/.claude
    const homeDir = require('os').homedir();
    const resolvedPath = require('path').resolve(sourcePath);
    if (!resolvedPath.startsWith(homeDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!existsSync(sourcePath)) {
      return NextResponse.json({ error: 'Source path not found' }, { status: 404 });
    }

    let files: FileNode[] = [];

    if (type === 'skill') {
      // Skills are directories
      files = await buildFileTree(sourcePath, '');
    } else {
      // Commands and agents are single files
      const fileName = sourcePath.split('/').pop()!;
      files = [{
        name: fileName,
        path: fileName,
        type: 'file' as const,
      }];
    }

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error listing files:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

async function buildFileTree(dirPath: string, relativePath: string): Promise<FileNode[]> {
  const fullPath = join(dirPath, relativePath);
  const entries = await readdir(fullPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }

    const entryPath = join(relativePath, entry.name);
    const node: FileNode = {
      name: entry.name,
      path: entryPath,
      type: entry.isDirectory() ? 'directory' : 'file',
    };

    if (entry.isDirectory()) {
      node.children = await buildFileTree(dirPath, entryPath);
    }

    nodes.push(node);
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
