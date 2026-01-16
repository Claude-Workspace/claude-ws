import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { getAgentFactoryDir } from './agent-factory-dir';
import { existsSync } from 'fs';

export interface GeneratePluginFileOptions {
  type: 'skill' | 'command' | 'agent';
  name: string;
  description?: string;
}

export interface PluginFileExistsError extends Error {
  code: 'PLUGIN_EXISTS';
  path: string;
}

/**
 * Generate plugin file(s) on disk for Agent Factory plugins
 * - Skills: Creates /agent-factory/skills/skill-name/SKILL.md
 * - Commands: Creates /agent-factory/commands/command-name.md
 * - Agents: Creates /agent-factory/agents/agent-name.md
 *
 * @throws {PluginFileExistsError} If plugin file already exists
 */
export async function generatePluginFile(options: GeneratePluginFileOptions): Promise<void> {
  const { type, name, description } = options;

  // Convert name to kebab-case for file/directory name
  const slug = toKebabCase(name);
  const agentFactoryDir = getAgentFactoryDir();

  let targetPath: string;

  if (type === 'skill') {
    // Skills: /agent-factory/skills/skill-name/SKILL.md
    targetPath = join(agentFactoryDir, 'skills', slug, 'SKILL.md');
  } else if (type === 'command') {
    // Commands: /agent-factory/commands/command-name.md
    targetPath = join(agentFactoryDir, 'commands', `${slug}.md`);
  } else {
    // Agents: /agent-factory/agents/agent-name.md
    targetPath = join(agentFactoryDir, 'agents', `${slug}.md`);
  }

  // Check if plugin already exists
  if (existsSync(targetPath)) {
    const error = new Error(`Plugin already exists at ${targetPath}`) as PluginFileExistsError;
    error.code = 'PLUGIN_EXISTS';
    error.path = targetPath;
    throw error;
  }

  // Generate YAML frontmatter content
  const frontmatter = generateFrontmatter(name, description);

  // Create directory structure and file
  const dirPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
  await mkdir(dirPath, { recursive: true });
  await writeFile(targetPath, frontmatter, 'utf-8');
}

/**
 * Get the file path for a plugin (without creating it)
 */
export function getPluginPath(type: 'skill' | 'command' | 'agent', name: string): string {
  const slug = toKebabCase(name);
  const agentFactoryDir = getAgentFactoryDir();

  if (type === 'skill') {
    return join(agentFactoryDir, 'skills', slug, 'SKILL.md');
  } else if (type === 'command') {
    return join(agentFactoryDir, 'commands', `${slug}.md`);
  } else {
    return join(agentFactoryDir, 'agents', `${slug}.md`);
  }
}

/**
 * Check if plugin file already exists
 */
export function pluginExists(type: 'skill' | 'command' | 'agent', name: string): boolean {
  const path = getPluginPath(type, name);
  return existsSync(path);
}

/**
 * Generate YAML frontmatter for plugin file
 */
function generateFrontmatter(name: string, description?: string): string {
  let content = '---\n';
  content += `name: "${name}"\n`;
  if (description) {
    content += `description: "${description}"\n`;
  }
  content += '---\n';
  return content;
}

/**
 * Convert name to kebab-case for file/directory names
 */
function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
