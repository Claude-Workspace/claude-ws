import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { dependencyExtractor } from '@/lib/dependency-extractor';
import { claudeDependencyAnalyzer } from '@/lib/claude-dependency-analyzer';
import { installScriptGenerator } from '@/lib/install-script-generator';
import type { DependencyTreeNode } from '@/components/agent-factory/dependency-tree';
import { countPlugins } from '@/components/agent-factory/dependency-tree';

interface DependenciesRequest {
  sourcePath: string;
  type: 'skill' | 'command' | 'agent';
  useClaude?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json() as DependenciesRequest;
    const { sourcePath, type, useClaude } = body;

    if (!sourcePath || !type) {
      return NextResponse.json({ error: 'Missing sourcePath or type' }, { status: 400 });
    }

    const resolvedPath = require('path').resolve(sourcePath);
    if (!resolvedPath.startsWith(homedir())) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!existsSync(sourcePath)) {
      return NextResponse.json({ error: 'Source path not found' }, { status: 404 });
    }

    // Extract dependencies using Claude SDK or regex extractor
    let extracted;
    if (useClaude) {
      // Use Claude SDK for intelligent analysis
      const analyzed = await claudeDependencyAnalyzer.analyze(sourcePath, type);
      extracted = {
        libraries: analyzed.libraries,
        plugins: analyzed.plugins,
      };
    } else {
      // Use regex-based extraction
      extracted = await dependencyExtractor.extract(sourcePath, type);
    }

    // Generate install scripts
    const installScripts = installScriptGenerator.generateAll(extracted.libraries);

    // For non-recursive resolution (discovered plugins), create flat tree
    const dependencyTree: DependencyTreeNode[] = (extracted.plugins || []).map(comp => ({
      type: comp.type,
      name: comp.name,
      depth: 1,
    }));

    return NextResponse.json({
      libraries: extracted.libraries,
      plugins: extracted.plugins || [],
      installScripts,
      dependencyTree,
      depth: 1,
      hasCycles: false,
      totalPlugins: (extracted.plugins || []).length,
      resolvedAt: Date.now(),
      analysisMethod: useClaude ? 'claude-sdk' : 'regex',
    });
  } catch (error) {
    console.error('Error extracting dependencies:', error);
    return NextResponse.json({ error: 'Failed to extract dependencies' }, { status: 500 });
  }
}
