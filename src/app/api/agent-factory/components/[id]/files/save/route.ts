import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { db } from '@/lib/db';
import { agentFactoryComponents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';

interface SaveFileRequest {
  filePath: string;
  content: string;
}

// PUT /api/agent-factory/components/[id]/files/save - Save file content
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json() as SaveFileRequest;
    const { filePath, content } = body;

    // Get component from database
    const component = await db
      .select()
      .from(agentFactoryComponents)
      .where(eq(agentFactoryComponents.id, id))
      .get();

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    // Only allow editing local components
    if (component.storageType !== 'local') {
      return NextResponse.json({ error: 'Only local components can be edited' }, { status: 403 });
    }

    // Build the full file path
    let basePath: string | null | undefined;
    if (component.type === 'agent_set') {
      basePath = component.agentSetPath;
    } else {
      basePath = component.sourcePath;
    }

    if (!basePath) {
      return NextResponse.json({ error: 'Component path not found' }, { status: 404 });
    }

    let fullPath: string;
    if (component.type === 'skill') {
      // Skills: sourcePath points to SKILL.md, get parent directory
      const skillDir = dirname(component.sourcePath!);
      fullPath = join(skillDir, filePath);
    } else if (component.type === 'agent_set') {
      // Agent sets: agentSetPath is the directory
      fullPath = join(basePath, filePath);
    } else {
      // Commands/Agents: filePath should match the component file
      fullPath = component.sourcePath!;
    }

    // Security check: ensure file is within allowed paths
    const resolvedPath = require('path').resolve(fullPath);
    const homeDir = require('os').homedir();
    if (!resolvedPath.startsWith(homeDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Ensure directory exists
    const dirPath = dirname(fullPath);
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }

    // Write file content
    await writeFile(fullPath, content, 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving file:', error);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }
}
