/**
 * Agent Factory component discovery service - scans home directory for skill/command/agent
 * components and builds folder hierarchy for display in the agent factory UI
 */
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

// Directories to exclude during filesystem scanning
export const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.npm', '.yarn', '.pnpm',
  '.config', '.local', '.cache', '.vscode', '.idea', '.DS_Store',
  'dist', 'build', 'target', 'bin', 'obj', 'out', '.next', '.nuxt',
  'vendor', 'cache', 'tmp', 'temp', '.ts',
]);

export interface DiscoveredItem {
  type: 'skill' | 'command' | 'agent';
  name: string;
  description?: string;
  sourcePath: string;
  metadata?: Record<string, unknown>;
}

export interface DiscoveredFolder {
  type: 'folder';
  name: string;
  path: string;
  children: Array<DiscoveredFolder | DiscoveredItem>;
}

/**
 * Scan the home directory for skill/command/agent components, building folder hierarchy.
 * Excludes the given directory (e.g. the agent-factory data dir) from scanning.
 */
export async function discoverComponents(excludeDir: string): Promise<Array<DiscoveredFolder | DiscoveredItem>> {
  const discoveredItems = new Map<string, DiscoveredItem>();
  await scanDirectoryForComponents(homedir(), excludeDir, discoveredItems);
  return buildFolderHierarchy(discoveredItems);
}

/**
 * Recursively scan a directory for skills/commands/agents subdirectories
 */
export async function scanDirectoryForComponents(
  dir: string,
  excludeDir: string,
  discoveredItems: Map<string, DiscoveredItem>,
  depth = 0,
  visited = new Set<string>()
): Promise<void> {
  if (depth > 10 || visited.has(dir)) return;
  visited.add(dir);
  if (dir === excludeDir || dir.startsWith(excludeDir + '/')) return;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const dirName = dir.split('/').pop()!;

    if (['skills', 'commands', 'agents'].includes(dirName)) {
      await scanComponentDirectory(dir, dirName, discoveredItems);
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name)) {
        await scanDirectoryForComponents(path.join(dir, entry.name), excludeDir, discoveredItems, depth + 1, visited);
      }
    }
  } catch { /* skip unreadable dirs */ }
}

/**
 * Scan a specific skills/commands/agents directory and collect component items
 */
export async function scanComponentDirectory(
  componentDir: string,
  type: string,
  discoveredItems: Map<string, DiscoveredItem>,
  visited = new Set<string>()
): Promise<void> {
  if (visited.has(componentDir)) return;
  visited.add(componentDir);

  try {
    const entries = await fs.readdir(componentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (type === 'skills') {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const skillPath = path.join(componentDir, entry.name);
          const skillFile = path.join(skillPath, 'SKILL.md');
          if (existsSync(skillFile)) {
            const content = await fs.readFile(skillFile, 'utf-8');
            const parsed = parseYamlFrontmatter(content);
            discoveredItems.set(`skill-${skillPath}`, {
              type: 'skill',
              name: (parsed.name as string) || entry.name,
              description: parsed.description as string | undefined,
              sourcePath: skillPath,
              metadata: { ...parsed, originalName: entry.name },
            });
          } else {
            await scanComponentDirectory(skillPath, type, discoveredItems, visited);
          }
        }
      } else if (type === 'commands' || type === 'agents') {
        const compType = type === 'commands' ? 'command' : 'agent';
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(componentDir, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const parsed = parseYamlFrontmatter(content);
          discoveredItems.set(`${compType}-${filePath}`, {
            type: compType as 'command' | 'agent',
            name: (parsed.name as string) || entry.name.replace('.md', ''),
            description: parsed.description as string | undefined,
            sourcePath: filePath,
            metadata: { ...parsed, originalName: entry.name },
          });
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && !EXCLUDED_DIRS.has(entry.name)) {
          await scanComponentDirectory(path.join(componentDir, entry.name), type, discoveredItems, visited);
        }
      }
    }
  } catch { /* skip unreadable */ }
}

/**
 * Build a nested folder hierarchy from flat discovered items map,
 * grouping by parent directory relative to home
 */
export function buildFolderHierarchy(discoveredItems: Map<string, DiscoveredItem>): Array<DiscoveredFolder | DiscoveredItem> {
  const homeDir = homedir();
  const roots = new Map<string, DiscoveredFolder>();

  for (const [, item] of discoveredItems) {
    const relative = item.sourcePath.replace(homeDir + '/', '');
    const parts = relative.split('/');
    const compTypeIdx = parts.findIndex(p => ['skills', 'commands', 'agents'].includes(p));
    if (compTypeIdx === -1) continue;

    const parentDir = parts.slice(0, compTypeIdx).join('/');
    const componentType = parts[compTypeIdx];
    const itemParts = parts.slice(compTypeIdx + 1);

    let rootFolder: DiscoveredFolder;
    if (!roots.has(parentDir)) {
      const displayName = parentDir === '' ? `~/${componentType}` : `~/${parentDir}`;
      rootFolder = {
        type: 'folder',
        name: displayName,
        path: parentDir === '' ? path.join(homeDir, componentType) : path.join(homeDir, parentDir),
        children: [],
      };
      roots.set(parentDir, rootFolder);
    } else {
      rootFolder = roots.get(parentDir)!;
    }

    let currentFolder = rootFolder;
    let currentPath = rootFolder.path;

    if (parentDir !== '') {
      const compTypePath = path.join(homeDir, parentDir, componentType);
      let compTypeFolder = currentFolder.children.find(
        (c): c is DiscoveredFolder => c.type === 'folder' && (c as DiscoveredFolder).path === compTypePath
      ) as DiscoveredFolder | undefined;
      if (!compTypeFolder) {
        compTypeFolder = { type: 'folder', name: componentType, path: compTypePath, children: [] };
        currentFolder.children.push(compTypeFolder);
      }
      currentFolder = compTypeFolder;
      currentPath = compTypePath;
    }

    for (let i = 0; i < itemParts.length - 1; i++) {
      const folderPath = path.join(currentPath, itemParts[i]);
      let folder = currentFolder.children.find(
        (c): c is DiscoveredFolder => c.type === 'folder' && (c as DiscoveredFolder).path === folderPath
      ) as DiscoveredFolder | undefined;
      if (!folder) {
        folder = { type: 'folder', name: itemParts[i], path: folderPath, children: [] };
        currentFolder.children.push(folder);
      }
      currentFolder = folder;
      currentPath = folderPath;
    }

    currentFolder.children.push(item);
  }

  return Array.from(roots.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parse YAML frontmatter from markdown file content
 */
export function parseYamlFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return {};
  const result: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}
