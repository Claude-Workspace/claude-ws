import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentFactoryPlugins, projectPlugins } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';

const log = createLogger('AFProjectComponents');

// GET /api/agent-factory/projects/:projectId/components - Get plugins for project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { projectId } = await params;

    const assignedPlugins = await db
      .select({
        id: agentFactoryPlugins.id,
        type: agentFactoryPlugins.type,
        name: agentFactoryPlugins.name,
        description: agentFactoryPlugins.description,
        sourcePath: agentFactoryPlugins.sourcePath,
        storageType: agentFactoryPlugins.storageType,
        metadata: agentFactoryPlugins.metadata,
        createdAt: agentFactoryPlugins.createdAt,
        updatedAt: agentFactoryPlugins.updatedAt,
        assignmentId: projectPlugins.id,
        enabled: projectPlugins.enabled,
      })
      .from(projectPlugins)
      .innerJoin(agentFactoryPlugins, eq(projectPlugins.pluginId, agentFactoryPlugins.id))
      .where(eq(projectPlugins.projectId, projectId));

    return NextResponse.json({ components: assignedPlugins });
  } catch (error) {
    log.error({ error }, 'Error fetching project plugins');
    return NextResponse.json({ error: 'Failed to fetch project plugins' }, { status: 500 });
  }
}

// POST /api/agent-factory/projects/:projectId/components - Assign plugin to project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { projectId } = await params;
    const body = await request.json();
    const { componentId, enabled = true } = body;

    if (!componentId) {
      return NextResponse.json({ error: 'Missing componentId' }, { status: 400 });
    }

    // Check if plugin exists
    const plugin = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.id, componentId))
      .get();

    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Check if already assigned
    const existing = await db
      .select()
      .from(projectPlugins)
      .where(and(eq(projectPlugins.projectId, projectId), eq(projectPlugins.pluginId, componentId)))
      .get();

    if (existing) {
      return NextResponse.json({ error: 'Plugin already assigned to project' }, { status: 409 });
    }

    const now = Date.now();
    const newAssignment = {
      id: nanoid(),
      projectId,
      pluginId: componentId,
      enabled: enabled ? true : false,
      createdAt: now,
    };

    await db.insert(projectPlugins).values(newAssignment);

    return NextResponse.json({ assignment: newAssignment }, { status: 201 });
  } catch (error) {
    log.error({ error }, 'Error assigning plugin');
    return NextResponse.json({ error: 'Failed to assign plugin' }, { status: 500 });
  }
}

// DELETE /api/agent-factory/projects/:projectId/components/:componentId - Remove assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const componentId = searchParams.get('componentId');

    if (!componentId) {
      return NextResponse.json({ error: 'Missing componentId parameter' }, { status: 400 });
    }

    await db
      .delete(projectPlugins)
      .where(and(eq(projectPlugins.projectId, projectId), eq(projectPlugins.pluginId, componentId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ error }, 'Error removing plugin assignment');
    return NextResponse.json({ error: 'Failed to remove plugin' }, { status: 500 });
  }
}
