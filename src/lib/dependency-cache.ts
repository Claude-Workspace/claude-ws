import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { db } from '@/lib/db';
import { pluginDependencyCache } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface LibraryDep {
  name: string;
  version?: string;
  manager: 'npm' | 'pnpm' | 'yarn' | 'pip' | 'poetry' | 'cargo' | 'go' | 'composer' | 'gem';
}

export interface PluginDep {
  type: 'skill' | 'command' | 'agent';
  name: string;
}

export interface CachedDependencyData {
  id: string;
  pluginId?: string;
  sourcePath?: string;
  type: string;
  libraryDeps: LibraryDep[];
  pluginDeps: PluginDep[];
  installScriptNpm?: string;
  installScriptPnpm?: string;
  installScriptYarn?: string;
  installScriptPip?: string;
  installScriptPoetry?: string;
  installScriptCargo?: string;
  installScriptGo?: string;
  dockerfile?: string;
  depth: number;
  hasCycles: boolean;
  resolvedAt: number;
}

export class DependencyCacheService {
  /**
   * Get cached dependency data for an imported plugin
   */
  async getByPluginId(pluginId: string): Promise<CachedDependencyData | null> {
    const [cached] = await db
      .select()
      .from(pluginDependencyCache)
      .where(eq(pluginDependencyCache.pluginId, pluginId))
      .limit(1);

    return cached ? this.parseFromDb(cached) : null;
  }

  /**
   * Get cached dependency data for a source path (discovered components)
   */
  async getBySourcePath(sourcePath: string): Promise<CachedDependencyData | null> {
    const [cached] = await db
      .select()
      .from(pluginDependencyCache)
      .where(eq(pluginDependencyCache.sourcePath, sourcePath))
      .limit(1);

    if (!cached) return null;

    // Check if cache is still valid (hash matches)
    const currentHash = await this.computeFileHash(sourcePath);
    if (cached.sourceHash !== currentHash) {
      await this.invalidate(cached.id);
      return null;
    }

    return this.parseFromDb(cached);
  }

  /**
   * Store dependency data in cache
   */
  async set(data: Omit<CachedDependencyData, 'id'> & { id?: string }): Promise<string> {
    const sourceHash = data.sourcePath
      ? await this.computeFileHash(data.sourcePath)
      : null;

    const id = data.id || nanoid();

    const insertData: Record<string, any> = {
      id,
      pluginId: data.pluginId || null,
      sourcePath: data.sourcePath || null,
      sourceHash,
      type: data.type,
      libraryDeps: JSON.stringify(data.libraryDeps),
      pluginDeps: JSON.stringify(data.pluginDeps),
      installScriptNpm: data.installScriptNpm || null,
      installScriptPnpm: data.installScriptPnpm || null,
      installScriptYarn: data.installScriptYarn || null,
      installScriptPip: data.installScriptPip || null,
      installScriptPoetry: data.installScriptPoetry || null,
      installScriptCargo: data.installScriptCargo || null,
      installScriptGo: data.installScriptGo || null,
      dockerfile: data.dockerfile || null,
      depth: data.depth,
      hasCycles: data.hasCycles ? 1 : 0,
      resolvedAt: data.resolvedAt,
    };

    await db.insert(pluginDependencyCache).values(insertData as any);

    return id;
  }

  /**
   * Invalidate cache entry by ID
   */
  async invalidate(id: string): Promise<void> {
    await db
      .delete(pluginDependencyCache)
      .where(eq(pluginDependencyCache.id, id));
  }

  /**
   * Invalidate all cache for a plugin
   */
  async invalidateByPluginId(pluginId: string): Promise<void> {
    await db
      .delete(pluginDependencyCache)
      .where(eq(pluginDependencyCache.pluginId, pluginId));
  }

  /**
   * Invalidate all cache for a source path
   */
  async invalidateBySourcePath(sourcePath: string): Promise<void> {
    await db
      .delete(pluginDependencyCache)
      .where(eq(pluginDependencyCache.sourcePath, sourcePath));
  }

  /**
   * Compute hash of source files for cache invalidation
   */
  async computeFileHash(sourcePath: string): Promise<string> {
    try {
      const stats = await stat(sourcePath);
      // For files, use content + mtime + size
      // For directories, use mtime + size as proxy
      const isDirectory = stats.isDirectory();

      if (isDirectory) {
        const hashInput = `dir:${sourcePath}-${stats.mtimeMs}-${stats.size}`;
        return createHash('sha256').update(hashInput).digest('hex');
      } else {
        const content = await readFile(sourcePath, 'utf-8');
        const hashInput = `${content}-${stats.mtimeMs}-${stats.size}`;
        return createHash('sha256').update(hashInput).digest('hex');
      }
    } catch {
      // If we can't read the file, return a hash based on path only
      return createHash('sha256').update(sourcePath).digest('hex');
    }
  }

  private parseFromDb(row: any): CachedDependencyData {
    return {
      id: row.id,
      pluginId: row.pluginId || undefined,
      sourcePath: row.sourcePath || undefined,
      type: row.type,
      libraryDeps: JSON.parse(row.libraryDeps || '[]'),
      pluginDeps: JSON.parse(row.pluginDeps || '[]'),
      installScriptNpm: row.installScriptNpm || undefined,
      installScriptPnpm: row.installScriptPnpm || undefined,
      installScriptYarn: row.installScriptYarn || undefined,
      installScriptPip: row.installScriptPip || undefined,
      installScriptPoetry: row.installScriptPoetry || undefined,
      installScriptCargo: row.installScriptCargo || undefined,
      installScriptGo: row.installScriptGo || undefined,
      dockerfile: row.dockerfile || undefined,
      depth: row.depth,
      hasCycles: !!row.hasCycles,
      resolvedAt: row.resolvedAt,
    };
  }
}

export const dependencyCache = new DependencyCacheService();
