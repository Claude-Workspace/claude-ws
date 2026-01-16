import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { db } from '@/lib/db';
import { agentFactoryPlugins } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

// GET /api/agent-factory/plugins/[id]/files - List files in plugin directory
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    // Get plugin from database
    const plugin = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.id, id))
      .get();

    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    let pluginPath: string | null | undefined;

    // For agent sets: use agentSetPath
    // For others: use sourcePath
    if (plugin.type === 'agent_set') {
      pluginPath = plugin.agentSetPath;
    } else {
      pluginPath = plugin.sourcePath;
    }

    if (!pluginPath) {
      return NextResponse.json({ error: 'Plugin path not found' }, { status: 404 });
    }

    let fileTree: FileNode[];

    // For skills: sourcePath points to SKILL.md, get parent directory to list files
    // For commands/agents: sourcePath is the single file
    // For agent_sets: agentSetPath is the directory
    if (plugin.type === 'skill') {
      // sourcePath is .../skills/skill-name/SKILL.md, get parent directory
      const skillDir = dirname(pluginPath);

      // Check if skill directory exists
      if (!existsSync(skillDir)) {
        return NextResponse.json({ error: 'Skill directory not found' }, { status: 404 });
      }

      fileTree = await buildFileTree(skillDir, '');
    } else if (plugin.type === 'agent_set') {
      // agent_set: agentSetPath is the directory
      if (!existsSync(pluginPath)) {
        return NextResponse.json({ error: 'Agent set directory not found' }, { status: 404 });
      }

      fileTree = await buildFileTree(pluginPath, '');
    } else {
      // commands and agents: sourcePath is the single file
      if (!existsSync(pluginPath)) {
        return NextResponse.json({ error: 'Plugin file not found' }, { status: 404 });
      }

      const fileName = pluginPath.split('/').pop()!;
      fileTree = [{
        name: fileName,
        path: fileName,
        type: 'file' as const,
      }];
    }

    return NextResponse.json({ files: fileTree });
  } catch (error) {
    console.error('Error listing plugin files:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

async function buildFileTree(dirPath: string, relativePath: string): Promise<FileNode[]> {
  const fullPath = join(dirPath, relativePath);
  const entries = await readdir(fullPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // Skip hidden files and node_modules
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

  // Sort: directories first, then files, both alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
