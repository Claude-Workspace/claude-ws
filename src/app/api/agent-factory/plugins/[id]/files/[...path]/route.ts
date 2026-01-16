import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { readFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { db } from '@/lib/db';
import { agentFactoryPlugins } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/agent-factory/components/[id]/files/[...path] - Read file content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id, path } = await params;

    // Get component from database
    const component = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.id, id))
      .get();

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    // Build file path
    // For skills: sourcePath points to SKILL.md, get parent directory and join with requested path
    // For commands/agents: sourcePath is the file itself, use it directly if path is just the filename
    // For agent_sets: agentSetPath is the directory, join with requested path
    let basePath: string | null | undefined;
    if (component.type === 'agent_set') {
      basePath = component.agentSetPath;
    } else {
      basePath = component.sourcePath;
    }

    if (!basePath) {
      return NextResponse.json({ error: 'Component path not found' }, { status: 404 });
    }

    let filePath: string;
    if (component.type === 'skill') {
      // sourcePath is .../skills/skill-name/SKILL.md, get parent directory
      const skillDir = dirname(component.sourcePath!);
      filePath = join(skillDir, ...path);
    } else if (component.type === 'agent_set') {
      // agent_set: agentSetPath is the directory
      filePath = join(basePath, ...path);
    } else {
      // For commands/agents, if the path contains just the filename matching sourcePath, use sourcePath directly
      const fileName = component.sourcePath!.split('/').pop()!;
      if (path.length === 1 && path[0] === fileName) {
        filePath = component.sourcePath!;
      } else {
        // This shouldn't happen for commands/agents, but handle it gracefully
        filePath = component.sourcePath!;
      }
    }

    // Security check: ensure file is within allowed paths
    const resolvedPath = require('path').resolve(filePath);
    const homeDir = require('os').homedir();
    if (!resolvedPath.startsWith(homeDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if file exists and is a file
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      return NextResponse.json({ error: 'Is a directory' }, { status: 400 });
    }

    // Read file content
    const content = await readFile(filePath, 'utf-8');

    // Detect language from file extension for syntax highlighting
    const ext = path[path.length - 1]?.split('.').pop() || '';
    const language = getLanguageFromExtension(ext);

    return NextResponse.json({
      name: path[path.length - 1],
      path: path.join('/'),
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
    'Makefile': 'makefile',
    'cmake': 'cmake',
  };
  return langMap[ext.toLowerCase()] || 'text';
}
