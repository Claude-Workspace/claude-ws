import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { getGlobalClaudeDir } from '@/lib/agent-factory-dir';

interface DiscoveredItem {
  type: 'skill' | 'command' | 'agent';
  name: string;
  description?: string;
  sourcePath: string;
  metadata?: Record<string, unknown>;
}

interface DiscoveredFolder {
  type: 'folder';
  name: string;
  path: string;
  children: Array<DiscoveredFolder | DiscoveredItem>;
}

interface DiscoverResult {
  discovered: Array<DiscoveredFolder | DiscoveredItem>;
}

// Directories to exclude during scanning
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.npm',
  '.yarn',
  '.pnpm',
  '.config',
  '.local',
  '.cache',
  '.vscode',
  '.idea',
  '.DS_Store',
  'dist',
  'build',
  'target',
  'bin',
  'obj',
  'out',
  '.next',
  '.nuxt',
  'vendor',
  'cache',
  'tmp',
  'temp',
  '.ts',
]);

// Track all discovered items to build hierarchy
const discoveredItems = new Map<string, DiscoveredItem>();

// POST /api/agent-factory/discover - Scan filesystem for components
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    discoveredItems.clear();
    const claudeHomeDir = getGlobalClaudeDir();

    // Scan from home directory for component directories
    await scanDirectoryForComponents(homedir(), claudeHomeDir);

    // Build folder hierarchy from discovered items
    const discovered = buildFolderHierarchy();

    return NextResponse.json({ discovered });
  } catch (error) {
    console.error('Error discovering components:', error);
    return NextResponse.json({ error: 'Failed to discover components' }, { status: 500 });
  }
}

// Recursively scan directory for components
async function scanDirectoryForComponents(
  dir: string,
  excludeDir: string,
  depth = 0,
  visited = new Set<string>()
) {
  // Prevent infinite loops and limit depth
  if (depth > 10 || visited.has(dir)) {
    return;
  }
  visited.add(dir);

  // Skip if inside Claude home directory
  if (dir === excludeDir || dir.startsWith(excludeDir + '/')) {
    return;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    // Check if this is a component directory
    const dirName = dir.split('/').pop()!;
    if (['skills', 'commands', 'agents'].includes(dirName)) {
      await scanComponentDirectory(dir, dirName);
      // Don't recurse deeper into component directories
      return;
    }

    // Recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name)) {
        await scanDirectoryForComponents(
          join(dir, entry.name),
          excludeDir,
          depth + 1,
          visited
        );
      }
    }
  } catch {
    // Skip directories we can't read
  }
}

// Recursively scan a component directory for components
async function scanComponentDirectory(
  componentDir: string,
  type: string,
  visited = new Set<string>()
) {
  // Prevent infinite loops
  if (visited.has(componentDir)) {
    return;
  }
  visited.add(componentDir);

  try {
    const entries = await readdir(componentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (type === 'skills') {
        // Skills: recursively scan subdirectories for SKILL.md
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const skillPath = join(componentDir, entry.name);
          const skillFile = join(skillPath, 'SKILL.md');
          if (existsSync(skillFile)) {
            const content = await readFile(skillFile, 'utf-8');
            const parsed = parseYamlFrontmatter(content);
            const key = `skill-${skillPath}`;
            discoveredItems.set(key, {
              type: 'skill',
              name: (parsed.name as string) || entry.name,
              description: parsed.description as string | undefined,
              sourcePath: skillPath,
              metadata: { ...parsed, originalName: entry.name },
            });
          } else {
            // Recurse into subdirectory looking for SKILL.md
            await scanComponentDirectory(skillPath, type, visited);
          }
        }
      } else if (type === 'commands') {
        // Commands: scan for *.md files (recursively in subdirectories)
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const commandPath = join(componentDir, entry.name);
          const content = await readFile(commandPath, 'utf-8');
          const parsed = parseYamlFrontmatter(content);
          const key = `command-${commandPath}`;
          discoveredItems.set(key, {
            type: 'command',
            name: (parsed.name as string) || entry.name.replace('.md', ''),
            description: parsed.description as string | undefined,
            sourcePath: commandPath,
            metadata: { ...parsed, originalName: entry.name },
          });
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && !EXCLUDED_DIRS.has(entry.name)) {
          // Recurse into subdirectory
          await scanComponentDirectory(join(componentDir, entry.name), type, visited);
        }
      } else if (type === 'agents') {
        // Agents: scan for *.md files (recursively in subdirectories)
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const agentPath = join(componentDir, entry.name);
          const content = await readFile(agentPath, 'utf-8');
          const parsed = parseYamlFrontmatter(content);
          const key = `agent-${agentPath}`;
          discoveredItems.set(key, {
            type: 'agent',
            name: (parsed.name as string) || entry.name.replace('.md', ''),
            description: parsed.description as string | undefined,
            sourcePath: agentPath,
            metadata: { ...parsed, originalName: entry.name },
          });
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && !EXCLUDED_DIRS.has(entry.name)) {
          // Recurse into subdirectory
          await scanComponentDirectory(join(componentDir, entry.name), type, visited);
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }
}

// Build folder hierarchy from discovered items
function buildFolderHierarchy(): Array<DiscoveredFolder | DiscoveredItem> {
  const homeDir = homedir();
  const roots = new Map<string, DiscoveredFolder>();
  const rootPaths = new Set<string>();

  for (const [key, item] of discoveredItems) {
    const sourcePath = item.sourcePath;
    const relativePath = sourcePath.replace(homeDir + '/', '');

    // Find the component type directory (skills, commands, agents)
    const parts = relativePath.split('/');
    const componentTypeIndex = parts.findIndex((p) => ['skills', 'commands', 'agents'].includes(p));

    if (componentTypeIndex === -1) continue;

    // Get the parent directory of the component type directory
    const parentDir = parts.slice(0, componentTypeIndex).join('/');
    const componentType = parts[componentTypeIndex];
    const itemPathInComponent = parts.slice(componentTypeIndex + 1);

    // Create root folder if it doesn't exist
    let rootFolder: DiscoveredFolder;
    if (!roots.has(parentDir)) {
      // For root folder, use full relative path as name
      const displayName = parentDir === '' ? `~/${componentType}` : `~/${parentDir}`;
      rootFolder = {
        type: 'folder',
        name: displayName,
        path: parentDir === '' ? join(homeDir, componentType) : join(homeDir, parentDir),
        children: [],
      };
      roots.set(parentDir, rootFolder);
      rootPaths.add(rootFolder.path);
    } else {
      rootFolder = roots.get(parentDir)!;
    }

    // Build the nested folder structure
    let currentFolder = rootFolder;
    let currentPath = rootFolder.path;

    // Add component type folder (skills/commands/agents) if not at root
    if (parentDir !== '') {
      const componentTypePath = join(homeDir, parentDir, componentType);
      let componentTypeFolder = currentFolder.children.find(
        (c): c is DiscoveredFolder => c.type === 'folder' && c.path === componentTypePath
      );
      if (!componentTypeFolder) {
        componentTypeFolder = {
          type: 'folder',
          name: componentType,
          path: componentTypePath,
          children: [],
        };
        currentFolder.children.push(componentTypeFolder);
      }
      currentFolder = componentTypeFolder;
      currentPath = componentTypePath;
    }

    // Add intermediate folders
    for (let i = 0; i < itemPathInComponent.length - 1; i++) {
      const folderName = itemPathInComponent[i];
      const folderPath = join(currentPath, folderName);
      let folder = currentFolder.children.find(
        (c): c is DiscoveredFolder => c.type === 'folder' && c.path === folderPath
      );
      if (!folder) {
        folder = {
          type: 'folder',
          name: folderName,
          path: folderPath,
          children: [],
        };
        currentFolder.children.push(folder);
      }
      currentFolder = folder;
      currentPath = folderPath;
    }

    // Add the item
    currentFolder.children.push(item);
  }

  // Return root folders sorted by name
  return Array.from(roots.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Simple YAML frontmatter parser
function parseYamlFrontmatter(content: string): Record<string, unknown> {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {};
  }

  const yamlLines = match[1].split('\n');
  const result: Record<string, unknown> = {};

  for (const line of yamlLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }
  }

  return result;
}
