import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { getGlobalClaudeDir } from '@/lib/agent-factory-dir';

interface DiscoverResult {
  discovered: Array<{
    type: 'skill' | 'command' | 'agent';
    name: string;
    description?: string;
    sourcePath: string;
    metadata?: Record<string, unknown>;
  }>;
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

// POST /api/agent-factory/discover - Scan filesystem for components
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const discovered: DiscoverResult['discovered'] = [];
    const claudeHomeDir = getGlobalClaudeDir();

    // Scan from home directory for component directories
    await scanDirectoryForComponents(homedir(), claudeHomeDir, discovered);

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
  discovered: DiscoverResult['discovered'],
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
      await scanComponentDirectory(dir, dirName, discovered);
      // Don't recurse deeper into component directories
      return;
    }

    // Recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name)) {
        await scanDirectoryForComponents(
          join(dir, entry.name),
          excludeDir,
          discovered,
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
  discovered: DiscoverResult['discovered'],
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
            discovered.push({
              type: 'skill',
              name: (parsed.name as string) || entry.name,
              description: parsed.description as string | undefined,
              sourcePath: skillPath,
              metadata: { ...parsed, originalName: entry.name },
            });
          } else {
            // Recurse into subdirectory looking for SKILL.md
            await scanComponentDirectory(skillPath, type, discovered, visited);
          }
        }
      } else if (type === 'commands') {
        // Commands: scan for *.md files (recursively in subdirectories)
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const commandPath = join(componentDir, entry.name);
          const content = await readFile(commandPath, 'utf-8');
          const parsed = parseYamlFrontmatter(content);
          discovered.push({
            type: 'command',
            name: (parsed.name as string) || entry.name.replace('.md', ''),
            description: parsed.description as string | undefined,
            sourcePath: commandPath,
            metadata: { ...parsed, originalName: entry.name },
          });
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && !EXCLUDED_DIRS.has(entry.name)) {
          // Recurse into subdirectory
          await scanComponentDirectory(join(componentDir, entry.name), type, discovered, visited);
        }
      } else if (type === 'agents') {
        // Agents: scan for *.md files (recursively in subdirectories)
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const agentPath = join(componentDir, entry.name);
          const content = await readFile(agentPath, 'utf-8');
          const parsed = parseYamlFrontmatter(content);
          discovered.push({
            type: 'agent',
            name: (parsed.name as string) || entry.name.replace('.md', ''),
            description: parsed.description as string | undefined,
            sourcePath: agentPath,
            metadata: { ...parsed, originalName: entry.name },
          });
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && !EXCLUDED_DIRS.has(entry.name)) {
          // Recurse into subdirectory
          await scanComponentDirectory(join(componentDir, entry.name), type, discovered, visited);
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }
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
