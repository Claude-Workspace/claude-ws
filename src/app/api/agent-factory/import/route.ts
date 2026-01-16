import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { readFile, writeFile, mkdir, cp } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agentFactoryComponents } from '@/lib/db/schema';
import { getAgentFactoryDir } from '@/lib/agent-factory-dir';

interface ImportRequest {
  type: 'skill' | 'command' | 'agent';
  name: string;
  description?: string;
  sourcePath: string;
  metadata?: Record<string, unknown>;
}

// POST /api/agent-factory/import - Import component to .claude/agentfactory
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json() as ImportRequest;
    const { type, name, description, sourcePath, metadata } = body;

    if (!type || !name || !sourcePath) {
      return NextResponse.json({ error: 'Missing required fields: type, name, sourcePath' }, { status: 400 });
    }

    // Verify source exists
    if (!existsSync(sourcePath)) {
      return NextResponse.json({ error: 'Source path does not exist' }, { status: 404 });
    }

    // Create target directory in agent factory
    const agentFactoryDir = getAgentFactoryDir();

    // Organize by type: skills/, commands/, agents/
    const typeDir = join(agentFactoryDir, `${type}s`);

    // Ensure type directory exists
    if (!existsSync(typeDir)) {
      await mkdir(typeDir, { recursive: true });
    }

    let targetPath: string;
    if (type === 'skill') {
      // Skills are directories - copy entire directory
      targetPath = join(typeDir, name);
      await cp(sourcePath, targetPath, { recursive: true });
    } else {
      // Commands and agents are single files
      const fileName = sourcePath.split('/').pop()!;
      targetPath = join(typeDir, fileName);
      const content = await readFile(sourcePath, 'utf-8');
      await writeFile(targetPath, content, 'utf-8');
    }

    const now = Date.now();
    const newComponent = {
      id: nanoid(),
      type,
      name,
      description: description || null,
      sourcePath: targetPath,
      storageType: 'imported' as const,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(agentFactoryComponents).values(newComponent);

    return NextResponse.json({ component: newComponent }, { status: 201 });
  } catch (error) {
    console.error('Error importing component:', error);
    return NextResponse.json({ error: 'Failed to import component' }, { status: 500 });
  }
}
