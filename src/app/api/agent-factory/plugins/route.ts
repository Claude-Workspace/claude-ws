import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentFactoryPlugins } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { existsSync } from 'fs';
import { generatePluginFile, getPluginPath, pluginExists } from '@/lib/plugin-file-generator';
import { createLogger } from '@/lib/logger';

const log = createLogger('AFPlugins');

// GET /api/agent-factory/plugins - List all plugins
export async function GET(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // Filter by type: skill, command, agent, agent_set

    let plugins;
    if (type && ['skill', 'command', 'agent', 'agent_set'].includes(type)) {
      plugins = await db
        .select()
        .from(agentFactoryPlugins)
        .where(eq(agentFactoryPlugins.type, type as 'skill' | 'command' | 'agent' | 'agent_set'))
        .orderBy(desc(agentFactoryPlugins.createdAt));
    } else {
      plugins = await db
        .select()
        .from(agentFactoryPlugins)
        .orderBy(desc(agentFactoryPlugins.createdAt));
    }

    // Filter out imported plugins that don't exist in filesystem
    const validPlugins = plugins.filter((plugin) => {
      // Only check file existence for imported plugins
      if (plugin.storageType === 'imported') {
        // Agent sets use agentSetPath, others use sourcePath
        if (plugin.type === 'agent_set') {
          return plugin.agentSetPath && existsSync(plugin.agentSetPath);
        }
        return plugin.sourcePath && existsSync(plugin.sourcePath);
      }
      // Local and external plugins don't need file existence check
      return true;
    });

    return NextResponse.json({ plugins: validPlugins });
  } catch (error) {
    log.error({ error }, 'Error fetching plugins');
    return NextResponse.json({ error: 'Failed to fetch plugins' }, { status: 500 });
  }
}

// POST /api/agent-factory/plugins - Create plugin
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

    const pluginType = type as 'skill' | 'command' | 'agent';

    // Check if plugin file already exists on disk
    if (pluginExists(pluginType, name)) {
      const existingPath = getPluginPath(pluginType, name);
      return NextResponse.json(
        { error: `Plugin file already exists at ${existingPath}` },
        { status: 409 }
      );
    }

    // Check if plugin with same name and type already exists in database
    const existing = await db
      .select()
      .from(agentFactoryPlugins)
      .where(and(eq(agentFactoryPlugins.name, name), eq(agentFactoryPlugins.type, pluginType)))
      .get();

    if (existing) {
      return NextResponse.json({ error: 'Plugin with this name already exists in database' }, { status: 409 });
    }

    // Generate the plugin file on disk and get the actual path
    let actualPath: string;
    try {
      actualPath = getPluginPath(pluginType, name);
      await generatePluginFile({
        type: pluginType,
        name,
        description: description || undefined,
      });
    } catch (fileError: unknown) {
      const error = fileError as Error & { code?: string };
      if (error.code === 'PLUGIN_EXISTS') {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      log.error({ error: fileError }, 'Failed to generate plugin file');
      return NextResponse.json(
        { error: 'Failed to create plugin file on disk' },
        { status: 500 }
      );
    }

    const now = Date.now();
    const newPlugin = {
      id: nanoid(),
      type: pluginType,
      name,
      description: description || null,
      sourcePath: actualPath,
      storageType,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(agentFactoryPlugins).values(newPlugin);

    return NextResponse.json({ plugin: newPlugin }, { status: 201 });
  } catch (error) {
    log.error({ error }, 'Error creating plugin');
    return NextResponse.json({ error: 'Failed to create plugin' }, { status: 500 });
  }
}
