import { dependencyExtractor } from './dependency-extractor';
import { db } from './db';
import { agentFactoryPlugins } from './db/schema';
import { eq, and } from 'drizzle-orm';
import type { LibraryDep, PluginDep } from './dependency-extractor';

export interface ResolveOptions {
  maxDepth?: number;      // Default: 5
  currentDepth?: number;   // Internal tracking
  visited?: Set<string>;   // Cycle detection
}

export interface ResolvedComponent {
  type: 'skill' | 'command' | 'agent';
  name: string;
  depth: number;
  cycle?: boolean;
  missing?: boolean;
  truncated?: boolean;
  children?: ResolvedComponent[];
}

export interface ResolvedDependencyTree {
  root: {
    type: string;
    name: string;
  };
  libraries: LibraryDep[];
  components: ResolvedComponent[];
  maxDepth: number;
  hasCycles: boolean;
  totalComponents: number;
  allLibraries: LibraryDep[];
  componentMap: Map<string, PluginDep>;
}

/**
 * Dependency Resolver Service
 * Recursively resolves component dependencies with cycle detection and depth limiting
 */
export class DependencyResolver {
  private readonly defaultMaxDepth = 5;

  async resolve(
    component: { id: string; type: string; name: string; sourcePath: string },
    options: ResolveOptions = {}
  ): Promise<ResolvedDependencyTree> {
    const {
      maxDepth = this.defaultMaxDepth,
      currentDepth = 0,
      visited = new Set()
    } = options;

    const allLibraries = new Map<string, LibraryDep>();
    const allComponents = new Map<string, PluginDep>();
    const hasCycles = new Set<string>();

    // Get direct dependencies for root component
    const rootDeps = await dependencyExtractor.extract(component.sourcePath, component.type);

    // Collect libraries
    for (const lib of rootDeps.libraries) {
      const key = `${lib.manager}:${lib.name}`;
      allLibraries.set(key, lib);
    }

    // Resolve component dependencies recursively
    const components = await this.resolveComponents(
      rootDeps.plugins,
      { maxDepth, currentDepth: currentDepth + 1, visited },
      allLibraries,
      allComponents,
      hasCycles
    );

    return {
      root: {
        type: component.type,
        name: component.name
      },
      libraries: rootDeps.libraries,
      components,
      maxDepth: this.calculateMaxDepth(components),
      hasCycles: hasCycles.size > 0,
      totalComponents: this.countComponents(components),
      allLibraries: Array.from(allLibraries.values()),
      componentMap: allComponents
    };
  }

  /**
   * Resolve component dependencies recursively
   */
  private async resolveComponents(
    componentDeps: PluginDep[],
    options: ResolveOptions,
    allLibraries: Map<string, LibraryDep>,
    allComponents: Map<string, PluginDep>,
    hasCycles: Set<string>
  ): Promise<ResolvedComponent[]> {
    const { maxDepth = this.defaultMaxDepth, currentDepth = 0, visited = new Set() } = options;
    const resolved: ResolvedComponent[] = [];

    for (const compDep of componentDeps) {
      const key = `${compDep.type}-${compDep.name}`;

      // Track all unique components
      allComponents.set(key, compDep);

      // Base case: max depth reached
      if (currentDepth >= maxDepth) {
        resolved.push({
          ...compDep,
          depth: currentDepth,
          truncated: true
        });
        continue;
      }

      // Cycle detection
      if (visited.has(key)) {
        hasCycles.add(key);
        resolved.push({
          ...compDep,
          depth: currentDepth,
          cycle: true
        });
        continue;
      }

      // Find the component in database
      const component = await this.findComponent(compDep);

      if (!component) {
        // Component not found
        resolved.push({
          ...compDep,
          depth: currentDepth,
          missing: true
        });
        continue;
      }

      // Skip dependency extraction for agent sets (they don't have a sourcePath)
      if (component.sourcePath === null) {
        resolved.push({
          ...compDep,
          depth: currentDepth,
          children: []
        });
        continue;
      }

      // Extract dependencies for this component
      const deps = await dependencyExtractor.extract(component.sourcePath, component.type);

      // Collect libraries
      for (const lib of deps.libraries) {
        const libKey = `${lib.manager}:${lib.name}`;
        if (!allLibraries.has(libKey)) {
          allLibraries.set(libKey, lib);
        }
      }

      // Recursively resolve child components
      const newVisited = new Set(visited);
      newVisited.add(key);

      const children = await this.resolveComponents(
        deps.plugins,
        {
          maxDepth,
          currentDepth: currentDepth + 1,
          visited: newVisited
        },
        allLibraries,
        allComponents,
        hasCycles
      );

      resolved.push({
        ...compDep,
        depth: currentDepth,
        children: children.length > 0 ? children : undefined
      });
    }

    return resolved;
  }

  /**
   * Find a component by type and name
   */
  private async findComponent(dep: PluginDep): Promise<{
    id: string;
    type: string;
    name: string;
    sourcePath: string | null;
  } | null> {
    try {
      const [component] = await db
        .select({
          id: agentFactoryPlugins.id,
          type: agentFactoryPlugins.type,
          name: agentFactoryPlugins.name,
          sourcePath: agentFactoryPlugins.sourcePath,
        })
        .from(agentFactoryPlugins)
        .where(
          and(
            eq(agentFactoryPlugins.name, dep.name),
            eq(agentFactoryPlugins.type, dep.type)
          )
        )
        .limit(1);

      return component || null;
    } catch {
      return null;
    }
  }

  /**
   * Calculate the maximum depth in the tree
   */
  private calculateMaxDepth(components: ResolvedComponent[]): number {
    let maxDepth = 0;
    for (const comp of components) {
      if (comp.depth > maxDepth) {
        maxDepth = comp.depth;
      }
      if (comp.children) {
        const childDepth = this.calculateMaxDepth(comp.children);
        if (childDepth > maxDepth) {
          maxDepth = childDepth;
        }
      }
    }
    return maxDepth;
  }

  /**
   * Count total components in tree
   */
  private countComponents(components: ResolvedComponent[]): number {
    let count = components.length;
    for (const comp of components) {
      if (comp.children) {
        count += this.countComponents(comp.children);
      }
    }
    return count;
  }

  /**
   * Flatten component tree into a single array (for caching)
   */
  flattenComponents(components: ResolvedComponent[]): PluginDep[] {
    const result: PluginDep[] = [];
    for (const comp of components) {
      result.push({ type: comp.type, name: comp.name });
      if (comp.children) {
        result.push(...this.flattenComponents(comp.children));
      }
    }
    return result;
  }
}

export const dependencyResolver = new DependencyResolver();
