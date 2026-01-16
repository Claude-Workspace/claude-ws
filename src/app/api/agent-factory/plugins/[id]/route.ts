import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentFactoryPlugins } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { dirname } from 'path';

const rmAsync = promisify(require('fs').rm);
const statAsync = promisify(require('fs').stat);

// GET /api/agent-factory/plugins/:id - Get single plugin
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const plugin = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.id, id))
      .get();

    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    return NextResponse.json({ plugin });
  } catch (error) {
    console.error('Error fetching plugin:', error);
    return NextResponse.json({ error: 'Failed to fetch plugin' }, { status: 500 });
  }
}

// PUT /api/agent-factory/plugins/:id - Update plugin
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, sourcePath, metadata } = body;

    // Check if plugin exists
    const existing = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.id, id))
      .get();

    if (!existing) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (sourcePath !== undefined) updateData.sourcePath = sourcePath;
    if (metadata !== undefined) updateData.metadata = metadata ? JSON.stringify(metadata) : null;

    await db
      .update(agentFactoryPlugins)
      .set(updateData)
      .where(eq(agentFactoryPlugins.id, id));

    const updated = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.id, id))
      .get();

    return NextResponse.json({ plugin: updated });
  } catch (error) {
    console.error('Error updating plugin:', error);
    return NextResponse.json({ error: 'Failed to update plugin' }, { status: 500 });
  }
}

// DELETE /api/agent-factory/plugins/:id - Delete plugin
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    // Check if plugin exists
    const existing = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.id, id))
      .get();

    if (!existing) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Delete files from disk for local and imported plugins in agent-factory
    // Skip external plugins as they're managed elsewhere
    let shouldDeleteFiles = false;
    let deletePath: string | null = null;

    if (existing.storageType === 'local' || existing.storageType === 'imported') {
      if (existing.type === 'agent_set') {
        shouldDeleteFiles = !!(existing.agentSetPath && existing.agentSetPath.includes('/agent-factory/'));
        deletePath = existing.agentSetPath || null;
      } else {
        shouldDeleteFiles = !!(existing.sourcePath && existing.sourcePath.includes('/agent-factory/'));
        deletePath = existing.sourcePath || null;
      }
    }

    if (shouldDeleteFiles && deletePath && existsSync(deletePath)) {
      try {
        if (existing.type === 'skill') {
          // Skills: sourcePath points to SKILL.md, delete the parent directory
          const skillDir = dirname(deletePath);
          await rmAsync(skillDir, { recursive: true, force: true });
          console.log(`Deleted skill directory: ${skillDir}`);
        } else if (existing.type === 'agent_set') {
          // Agent sets: delete the entire directory
          await rmAsync(deletePath, { recursive: true, force: true });
          console.log(`Deleted agent set directory: ${deletePath}`);
        } else {
          // Commands/Agents: delete the single file
          await rmAsync(deletePath, { force: true });
          console.log(`Deleted plugin file: ${deletePath}`);
        }
      } catch (error) {
        console.error(`Failed to delete plugin files:`, error);
        // Continue with database deletion even if file deletion fails
      }
    }

    await db.delete(agentFactoryPlugins).where(eq(agentFactoryPlugins.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plugin:', error);
    return NextResponse.json({ error: 'Failed to delete plugin' }, { status: 500 });
  }
}
