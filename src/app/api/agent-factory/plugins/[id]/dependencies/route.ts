import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/db';
import { agentFactoryPlugins } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { dependencyExtractor } from '@/lib/dependency-extractor';
import { dependencyCache } from '@/lib/dependency-cache';
import { installScriptGenerator } from '@/lib/install-script-generator';
import { claudeDependencyAnalyzer } from '@/lib/claude-dependency-analyzer';
import type { DependencyTreeNode } from '@/components/agent-factory/dependency-tree';
import { createLogger } from '@/lib/logger';

const log = createLogger('AFPluginDeps');

interface DependenciesRequest {
  force?: boolean; // Force re-resolution by clearing cache
  useClaude?: boolean; // Use Claude SDK for intelligent analysis
}

// Helper to get the base path for a plugin
function getPluginBasePath(plugin: any): string | null {
  if (plugin.type === 'agent_set') {
    return plugin.agentSetPath;
  }
  return plugin.sourcePath;
}

// Helper to extract dependencies from an agent set (aggregates from all plugins)
async function extractAgentSetDependencies(agentSetPath: string) {
  const libraries: any[] = [];
  const plugins: any[] = [];
  const subdirs = ['skills', 'commands', 'agents'];

  for (const subdir of subdirs) {
    const subdirPath = join(agentSetPath, subdir);
    if (!existsSync(subdirPath)) continue;

    const entries = readdirSync(subdirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const entryPath = join(subdirPath, entry.name);
      let type: 'skill' | 'command' | 'agent';
      let sourcePath: string;

      if (entry.isDirectory()) {
        // Skill directory
        type = 'skill';
        sourcePath = join(entryPath, 'SKILL.md');
      } else {
        // Single file (command or agent)
        const ext = entry.name.split('.').pop();
        if (subdir === 'commands') {
          type = 'command';
        } else {
          type = 'agent';
        }
        sourcePath = entryPath;
      }

      if (existsSync(sourcePath)) {
        try {
          const extracted = await dependencyExtractor.extract(sourcePath, type);
          libraries.push(...extracted.libraries);
          plugins.push(...extracted.plugins);
        } catch {
          // Skip files that fail to extract
        }
      }
    }
  }

  return { libraries, plugins };
}

// GET /api/agent-factory/plugins/:id/dependencies - Get plugin dependencies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const [plugin] = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.id, id))
      .limit(1);

    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    const pluginBasePath = getPluginBasePath(plugin);
    if (!pluginBasePath || !existsSync(pluginBasePath)) {
      return NextResponse.json({ error: 'Plugin source not found' }, { status: 404 });
    }

    // Check cache first
    const forceReResolve = request.nextUrl.searchParams.get('force') === 'true';
    if (!forceReResolve) {
      const cached = await dependencyCache.getByPluginId(id);
      if (cached) {
        return NextResponse.json({
          libraries: cached.libraryDeps,
          plugins: cached.pluginDeps,
          installScripts: {
            npm: cached.installScriptNpm,
            pnpm: cached.installScriptPnpm,
            yarn: cached.installScriptYarn,
            pip: cached.installScriptPip,
            poetry: cached.installScriptPoetry,
            cargo: cached.installScriptCargo,
            go: cached.installScriptGo,
            dockerfile: cached.dockerfile,
          },
          dependencyTree: cached.pluginDeps.map((c: any) => ({
            type: c.type,
            name: c.name,
            depth: 1,
          })),
          depth: cached.depth,
          hasCycles: cached.hasCycles,
          totalPlugins: cached.pluginDeps?.length || 0,
          resolvedAt: cached.resolvedAt,
        });
      }
    }

    // Extract dependencies
    let extracted;
    if (plugin.type === 'agent_set') {
      extracted = await extractAgentSetDependencies(pluginBasePath);
    } else {
      extracted = await dependencyExtractor.extract(pluginBasePath, plugin.type);
    }

    // Generate install scripts
    const installScripts = installScriptGenerator.generateAll(extracted.libraries);

    // Create dependency tree
    const dependencyTree: DependencyTreeNode[] = extracted.plugins.map(comp => ({
      type: comp.type,
      name: comp.name,
      depth: 1,
    }));

    // Cache the results
    await dependencyCache.set({
      pluginId: id,
      sourcePath: pluginBasePath,
      type: plugin.type,
      libraryDeps: extracted.libraries,
      pluginDeps: extracted.plugins,
      installScriptNpm: installScripts.npm,
      installScriptPnpm: installScripts.pnpm,
      installScriptYarn: installScripts.yarn,
      installScriptPip: installScripts.pip,
      installScriptPoetry: installScripts.poetry,
      installScriptCargo: installScripts.cargo,
      installScriptGo: installScripts.go,
      dockerfile: installScripts.dockerfile,
      depth: 1,
      hasCycles: false,
      resolvedAt: Date.now(),
    });

    return NextResponse.json({
      libraries: extracted.libraries,
      plugins: extracted.plugins,
      installScripts,
      dependencyTree,
      depth: 1,
      hasCycles: false,
      totalPlugins: extracted.plugins.length,
      resolvedAt: Date.now(),
    });
  } catch (error) {
    log.error({ error }, 'Error extracting dependencies');
    return NextResponse.json({ error: 'Failed to extract dependencies' }, { status: 500 });
  }
}

// POST /api/agent-factory/plugins/:id/dependencies - Re-resolve dependencies
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({})) as DependenciesRequest;
    const useClaude = body.useClaude === true;

    // Invalidate cache for this plugin
    await dependencyCache.invalidateByPluginId(id);

    // Get plugin
    const [plugin] = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.id, id))
      .limit(1);

    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    const pluginBasePath = getPluginBasePath(plugin);
    if (!pluginBasePath || !existsSync(pluginBasePath)) {
      return NextResponse.json({ error: 'Plugin source not found' }, { status: 404 });
    }

    // Extract dependencies using Claude SDK or regex extractor
    let extracted;
    if (plugin.type === 'agent_set') {
      // Agent sets: aggregate from all plugins
      extracted = await extractAgentSetDependencies(pluginBasePath);
    } else if (useClaude) {
      // Use Claude SDK for intelligent analysis
      const analyzed = await claudeDependencyAnalyzer.analyze(pluginBasePath, plugin.type);
      extracted = {
        libraries: analyzed.libraries,
        plugins: analyzed.plugins,
      };
    } else {
      // Use regex-based extraction
      extracted = await dependencyExtractor.extract(pluginBasePath, plugin.type);
    }

    // Generate install scripts
    const installScripts = installScriptGenerator.generateAll(extracted.libraries);

    // Create dependency tree
    const dependencyTree: DependencyTreeNode[] = extracted.plugins.map(comp => ({
      type: comp.type,
      name: comp.name,
      depth: 1,
    }));

    // Cache the results
    await dependencyCache.set({
      pluginId: id,
      sourcePath: pluginBasePath,
      type: plugin.type,
      libraryDeps: extracted.libraries,
      pluginDeps: extracted.plugins,
      installScriptNpm: installScripts.npm,
      installScriptPnpm: installScripts.pnpm,
      installScriptYarn: installScripts.yarn,
      installScriptPip: installScripts.pip,
      installScriptPoetry: installScripts.poetry,
      installScriptCargo: installScripts.cargo,
      installScriptGo: installScripts.go,
      dockerfile: installScripts.dockerfile,
      depth: 1,
      hasCycles: false,
      resolvedAt: Date.now(),
    });

    return NextResponse.json({
      libraries: extracted.libraries,
      plugins: extracted.plugins,
      installScripts,
      dependencyTree,
      depth: 1,
      hasCycles: false,
      totalPlugins: extracted.plugins.length,
      resolvedAt: Date.now(),
      message: useClaude
        ? 'Dependencies analyzed with Claude SDK successfully'
        : 'Dependencies re-resolved successfully',
      analysisMethod: useClaude ? 'claude-sdk' : 'regex',
    });
  } catch (error) {
    log.error({ error }, 'Error re-resolving dependencies');
    return NextResponse.json({ error: 'Failed to re-resolve dependencies' }, { status: 500 });
  }
}
