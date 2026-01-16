import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/db';
import { agentFactoryComponents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { dependencyExtractor } from '@/lib/dependency-extractor';
import { dependencyCache } from '@/lib/dependency-cache';
import { installScriptGenerator } from '@/lib/install-script-generator';
import { claudeDependencyAnalyzer } from '@/lib/claude-dependency-analyzer';
import type { DependencyTreeNode } from '@/components/agent-factory/dependency-tree';

interface DependenciesRequest {
  force?: boolean; // Force re-resolution by clearing cache
  useClaude?: boolean; // Use Claude SDK for intelligent analysis
}

// Helper to get the base path for a component
function getComponentBasePath(component: any): string | null {
  if (component.type === 'agent_set') {
    return component.agentSetPath;
  }
  return component.sourcePath;
}

// Helper to extract dependencies from an agent set (aggregates from all components)
async function extractAgentSetDependencies(agentSetPath: string) {
  const libraries: any[] = [];
  const components: any[] = [];
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
          components.push(...extracted.components);
        } catch {
          // Skip files that fail to extract
        }
      }
    }
  }

  return { libraries, components };
}

// GET /api/agent-factory/components/:id/dependencies - Get component dependencies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const [component] = await db
      .select()
      .from(agentFactoryComponents)
      .where(eq(agentFactoryComponents.id, id))
      .limit(1);

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const componentBasePath = getComponentBasePath(component);
    if (!componentBasePath || !existsSync(componentBasePath)) {
      return NextResponse.json({ error: 'Component source not found' }, { status: 404 });
    }

    // Check cache first
    const forceReResolve = request.nextUrl.searchParams.get('force') === 'true';
    if (!forceReResolve) {
      const cached = await dependencyCache.getByComponentId(id);
      if (cached) {
        return NextResponse.json({
          libraries: cached.libraryDeps,
          components: cached.componentDeps,
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
          dependencyTree: cached.componentDeps.map((c: any) => ({
            type: c.type,
            name: c.name,
            depth: 1,
          })),
          depth: cached.depth,
          hasCycles: cached.hasCycles,
          totalComponents: cached.componentDeps?.length || 0,
          resolvedAt: cached.resolvedAt,
        });
      }
    }

    // Extract dependencies
    let extracted;
    if (component.type === 'agent_set') {
      extracted = await extractAgentSetDependencies(componentBasePath);
    } else {
      extracted = await dependencyExtractor.extract(componentBasePath, component.type);
    }

    // Generate install scripts
    const installScripts = installScriptGenerator.generateAll(extracted.libraries);

    // Create dependency tree
    const dependencyTree: DependencyTreeNode[] = extracted.components.map(comp => ({
      type: comp.type,
      name: comp.name,
      depth: 1,
    }));

    // Cache the results
    await dependencyCache.set({
      componentId: id,
      sourcePath: componentBasePath,
      type: component.type,
      libraryDeps: extracted.libraries,
      componentDeps: extracted.components,
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
      components: extracted.components,
      installScripts,
      dependencyTree,
      depth: 1,
      hasCycles: false,
      totalComponents: extracted.components.length,
      resolvedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error extracting dependencies:', error);
    return NextResponse.json({ error: 'Failed to extract dependencies' }, { status: 500 });
  }
}

// POST /api/agent-factory/components/:id/dependencies - Re-resolve dependencies
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

    // Invalidate cache for this component
    await dependencyCache.invalidateByComponentId(id);

    // Get component
    const [component] = await db
      .select()
      .from(agentFactoryComponents)
      .where(eq(agentFactoryComponents.id, id))
      .limit(1);

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const componentBasePath = getComponentBasePath(component);
    if (!componentBasePath || !existsSync(componentBasePath)) {
      return NextResponse.json({ error: 'Component source not found' }, { status: 404 });
    }

    // Extract dependencies using Claude SDK or regex extractor
    let extracted;
    if (component.type === 'agent_set') {
      // Agent sets: aggregate from all components
      extracted = await extractAgentSetDependencies(componentBasePath);
    } else if (useClaude) {
      // Use Claude SDK for intelligent analysis
      const analyzed = await claudeDependencyAnalyzer.analyze(componentBasePath, component.type);
      extracted = {
        libraries: analyzed.libraries,
        components: analyzed.components,
      };
    } else {
      // Use regex-based extraction
      extracted = await dependencyExtractor.extract(componentBasePath, component.type);
    }

    // Generate install scripts
    const installScripts = installScriptGenerator.generateAll(extracted.libraries);

    // Create dependency tree
    const dependencyTree: DependencyTreeNode[] = extracted.components.map(comp => ({
      type: comp.type,
      name: comp.name,
      depth: 1,
    }));

    // Cache the results
    await dependencyCache.set({
      componentId: id,
      sourcePath: componentBasePath,
      type: component.type,
      libraryDeps: extracted.libraries,
      componentDeps: extracted.components,
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
      components: extracted.components,
      installScripts,
      dependencyTree,
      depth: 1,
      hasCycles: false,
      totalComponents: extracted.components.length,
      resolvedAt: Date.now(),
      message: useClaude
        ? 'Dependencies analyzed with Claude SDK successfully'
        : 'Dependencies re-resolved successfully',
      analysisMethod: useClaude ? 'claude-sdk' : 'regex',
    });
  } catch (error) {
    console.error('Error re-resolving dependencies:', error);
    return NextResponse.json({ error: 'Failed to re-resolve dependencies' }, { status: 500 });
  }
}
