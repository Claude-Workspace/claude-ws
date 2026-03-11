import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { existsSync } from 'fs';
import { generatePluginFile, getPluginPath, pluginExists } from '@agentic-sdk/services/agent-factory-plugin-file-generator-service';
import { createAgentFactoryService } from '@agentic-sdk/services/agent-factory-plugin-registry-service';
import { createLogger } from '@/lib/logger';

const log = createLogger('AFPlugins');
const agentFactoryService = createAgentFactoryService(db);

// GET /api/agent-factory/plugins - List all plugins
export async function GET(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? undefined;

    const plugins = await agentFactoryService.listPlugins({
      type: type && ['skill', 'command', 'agent', 'agent_set'].includes(type) ? type : undefined,
      orderByDesc: true,
    });

    // Filter out imported plugins whose source no longer exists on disk
    const validPlugins = (plugins as any[]).filter((plugin: any) => {
      if (plugin.storageType === 'imported') {
        return agentFactoryService.pluginSourceExists(plugin);
      }
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
    if (!verifyApiKey(request)) return unauthorizedResponse();

    const body = await request.json();
    const { type, name, description, storageType = 'local', metadata } = body;

    if (!type || !name) {
      return NextResponse.json({ error: 'Missing required fields: type, name' }, { status: 400 });
    }
    if (!['skill', 'command', 'agent'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be skill, command, or agent' }, { status: 400 });
    }

    const pluginType = type as 'skill' | 'command' | 'agent';

    if (pluginExists(pluginType, name)) {
      return NextResponse.json({ error: `Plugin file already exists at ${getPluginPath(pluginType, name)}` }, { status: 409 });
    }

    const existing = await agentFactoryService.findPlugin(name, pluginType);
    if (existing) {
      return NextResponse.json({ error: 'Plugin with this name already exists in database' }, { status: 409 });
    }

    let actualPath: string;
    try {
      actualPath = getPluginPath(pluginType, name);
      await generatePluginFile({ type: pluginType, name, description: description || undefined });
    } catch (fileError: unknown) {
      const err = fileError as Error & { code?: string };
      if (err.code === 'PLUGIN_EXISTS') {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      log.error({ error: fileError }, 'Failed to generate plugin file');
      return NextResponse.json({ error: 'Failed to create plugin file on disk' }, { status: 500 });
    }

    const plugin = await agentFactoryService.createPlugin({
      type: pluginType,
      name,
      description: description || undefined,
      sourcePath: actualPath,
      storageType,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    return NextResponse.json({ plugin }, { status: 201 });
  } catch (error) {
    log.error({ error }, 'Error creating plugin');
    return NextResponse.json({ error: 'Failed to create plugin' }, { status: 500 });
  }
}
