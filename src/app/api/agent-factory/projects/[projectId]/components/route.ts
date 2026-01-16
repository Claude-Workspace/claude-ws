import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentFactoryComponents, projectComponents } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// GET /api/agent-factory/projects/:projectId/components - Get components for project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { projectId } = await params;

    const projectComps = await db
      .select({
        id: agentFactoryComponents.id,
        type: agentFactoryComponents.type,
        name: agentFactoryComponents.name,
        description: agentFactoryComponents.description,
        sourcePath: agentFactoryComponents.sourcePath,
        storageType: agentFactoryComponents.storageType,
        metadata: agentFactoryComponents.metadata,
        createdAt: agentFactoryComponents.createdAt,
        updatedAt: agentFactoryComponents.updatedAt,
        assignmentId: projectComponents.id,
        enabled: projectComponents.enabled,
      })
      .from(projectComponents)
      .innerJoin(agentFactoryComponents, eq(projectComponents.componentId, agentFactoryComponents.id))
      .where(eq(projectComponents.projectId, projectId));

    return NextResponse.json({ components: projectComps });
  } catch (error) {
    console.error('Error fetching project components:', error);
    return NextResponse.json({ error: 'Failed to fetch project components' }, { status: 500 });
  }
}

// POST /api/agent-factory/projects/:projectId/components - Assign component to project
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

    // Check if component exists
    const component = await db
      .select()
      .from(agentFactoryComponents)
      .where(eq(agentFactoryComponents.id, componentId))
      .get();

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    // Check if already assigned
    const existing = await db
      .select()
      .from(projectComponents)
      .where(and(eq(projectComponents.projectId, projectId), eq(projectComponents.componentId, componentId)))
      .get();

    if (existing) {
      return NextResponse.json({ error: 'Component already assigned to project' }, { status: 409 });
    }

    const now = Date.now();
    const newAssignment = {
      id: nanoid(),
      projectId,
      componentId,
      enabled: enabled ? true : false,
      createdAt: now,
    };

    await db.insert(projectComponents).values(newAssignment);

    return NextResponse.json({ assignment: newAssignment }, { status: 201 });
  } catch (error) {
    console.error('Error assigning component:', error);
    return NextResponse.json({ error: 'Failed to assign component' }, { status: 500 });
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
      .delete(projectComponents)
      .where(and(eq(projectComponents.projectId, projectId), eq(projectComponents.componentId, componentId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing component assignment:', error);
    return NextResponse.json({ error: 'Failed to remove component' }, { status: 500 });
  }
}
