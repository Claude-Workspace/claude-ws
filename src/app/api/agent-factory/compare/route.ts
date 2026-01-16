import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { readFile, writeFile, mkdir, cp, rm, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agentFactoryPlugins } from '@/lib/db/schema';
import { getAgentFactoryDir } from '@/lib/agent-factory-dir';
import { eq } from 'drizzle-orm';

interface CompareRequest {
  discovered: Array<{
    type: 'skill' | 'command' | 'agent';
    name: string;
    description?: string;
    sourcePath: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface ComponentWithStatus {
  type: string;
  name: string;
  description?: string;
  sourcePath: string;
  metadata?: Record<string, unknown>;
  status: 'new' | 'update' | 'current';
  existingPlugin?: {
    id: string;
    sourcePath: string | null;
    updatedAt: number;
  };
}

// POST /api/agent-factory/compare - Compare discovered components with imported ones
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json() as CompareRequest;
    const { discovered } = body;

    // Get all imported components
    const imported = await db
      .select()
      .from(agentFactoryPlugins)
      .where(eq(agentFactoryPlugins.storageType, 'imported'));

    const result: ComponentWithStatus[] = [];

    for (const comp of discovered) {
      const existing = imported.find(
        (c) => c.type === comp.type && c.name === comp.name
      );

      if (!existing) {
        result.push({ ...comp, status: 'new' });
        continue;
      }

      // Check if discovered component is newer by comparing file modification time
      const sourceExists = comp.sourcePath && existsSync(comp.sourcePath);
      const importedExists = existing.sourcePath && existsSync(existing.sourcePath);

      if (!sourceExists || !importedExists) {
        result.push({ ...comp, status: 'new' });
        continue;
      }

      try {
        const sourceStats = await stat(comp.sourcePath!);
        const importedStats = await stat(existing.sourcePath!);

        // Compare modification times
        const sourceMtime = sourceStats.mtimeMs;
        const importedMtime = importedStats.mtimeMs;

        if (sourceMtime > importedMtime) {
          result.push({
            ...comp,
            status: 'update',
            existingPlugin: {
              id: existing.id,
              sourcePath: existing.sourcePath,
              updatedAt: existing.updatedAt,
            },
          });
        } else {
          result.push({
            ...comp,
            status: 'current',
            existingPlugin: {
              id: existing.id,
              sourcePath: existing.sourcePath,
              updatedAt: existing.updatedAt,
            },
          });
        }
      } catch {
        // If we can't compare, treat as new
        result.push({ ...comp, status: 'new' });
      }
    }

    return NextResponse.json({ plugins: result });
  } catch (error) {
    console.error('Error comparing plugins:', error);
    return NextResponse.json({ error: 'Failed to compare plugins' }, { status: 500 });
  }
}
