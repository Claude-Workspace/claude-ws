import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentFactoryComponents } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { existsSync } from 'fs';
import { generateComponentFile, getComponentPath, componentExists } from '@/lib/component-file-generator';

// GET /api/agent-factory/components - List all components
export async function GET(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // Filter by type: skill, command, agent, agent_set

    let components;
    if (type && ['skill', 'command', 'agent', 'agent_set'].includes(type)) {
      components = await db
        .select()
        .from(agentFactoryComponents)
        .where(eq(agentFactoryComponents.type, type as 'skill' | 'command' | 'agent' | 'agent_set'))
        .orderBy(desc(agentFactoryComponents.createdAt));
    } else {
      components = await db
        .select()
        .from(agentFactoryComponents)
        .orderBy(desc(agentFactoryComponents.createdAt));
    }

    // Filter out imported components that don't exist in filesystem
    const validComponents = components.filter((component) => {
      // Only check file existence for imported components
      if (component.storageType === 'imported') {
        // Agent sets use agentSetPath, others use sourcePath
        if (component.type === 'agent_set') {
          return component.agentSetPath && existsSync(component.agentSetPath);
        }
        return component.sourcePath && existsSync(component.sourcePath);
      }
      // Local and external components don't need file existence check
      return true;
    });

    return NextResponse.json({ components: validComponents });
  } catch (error) {
    console.error('Error fetching components:', error);
    return NextResponse.json({ error: 'Failed to fetch components' }, { status: 500 });
  }
}

// POST /api/agent-factory/components - Create component
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { type, name, description, storageType = 'local', metadata } = body;

    // Validate required fields
    if (!type || !name) {
      return NextResponse.json({ error: 'Missing required fields: type, name' }, { status: 400 });
    }

    if (!['skill', 'command', 'agent'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be skill, command, or agent' }, { status: 400 });
    }

    const componentType = type as 'skill' | 'command' | 'agent';

    // Check if component file already exists on disk
    if (componentExists(componentType, name)) {
      const existingPath = getComponentPath(componentType, name);
      return NextResponse.json(
        { error: `Component file already exists at ${existingPath}` },
        { status: 409 }
      );
    }

    // Check if component with same name and type already exists in database
    const existing = await db
      .select()
      .from(agentFactoryComponents)
      .where(and(eq(agentFactoryComponents.name, name), eq(agentFactoryComponents.type, componentType)))
      .get();

    if (existing) {
      return NextResponse.json({ error: 'Component with this name already exists in database' }, { status: 409 });
    }

    // Generate the component file on disk and get the actual path
    let actualPath: string;
    try {
      actualPath = getComponentPath(componentType, name);
      await generateComponentFile({
        type: componentType,
        name,
        description: description || undefined,
      });
    } catch (fileError: unknown) {
      const error = fileError as Error & { code?: string };
      if (error.code === 'COMPONENT_EXISTS') {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      console.error('Failed to generate component file:', fileError);
      return NextResponse.json(
        { error: 'Failed to create component file on disk' },
        { status: 500 }
      );
    }

    const now = Date.now();
    const newComponent = {
      id: nanoid(),
      type: componentType,
      name,
      description: description || null,
      sourcePath: actualPath,
      storageType,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(agentFactoryComponents).values(newComponent);

    return NextResponse.json({ component: newComponent }, { status: 201 });
  } catch (error) {
    console.error('Error creating component:', error);
    return NextResponse.json({ error: 'Failed to create component' }, { status: 500 });
  }
}
