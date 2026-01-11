import { NextResponse } from 'next/server';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface CommandInfo {
  name: string;
  description: string;
  argumentHint?: string;
  isBuiltIn?: boolean;
  isInteractive?: boolean;
}

// Built-in Claude Code commands
const BUILTIN_COMMANDS: CommandInfo[] = [
  { name: 'bug', description: 'Report bugs (sends conversation to Anthropic)', isBuiltIn: true },
  { name: 'clear', description: 'Clear conversation history', isBuiltIn: true, isInteractive: true },
  { name: 'compact', description: 'Compact conversation to save context', isBuiltIn: true, isInteractive: true },
  { name: 'config', description: 'View/modify configuration', isBuiltIn: true, isInteractive: true },
  { name: 'cost', description: 'Show token usage and cost', isBuiltIn: true },
  { name: 'doctor', description: 'Check Claude Code installation health', isBuiltIn: true },
  { name: 'help', description: 'Show help and available commands', isBuiltIn: true },
  { name: 'init', description: 'Initialize project with CLAUDE.md', isBuiltIn: true },
  { name: 'login', description: 'Switch Anthropic accounts', isBuiltIn: true },
  { name: 'logout', description: 'Sign out from Anthropic account', isBuiltIn: true },
  { name: 'mcp', description: 'View MCP server status', isBuiltIn: true },
  { name: 'memory', description: 'Edit CLAUDE.md memory files', isBuiltIn: true },
  { name: 'model', description: 'Switch AI model', isBuiltIn: true, isInteractive: true },
  { name: 'permissions', description: 'View/update permissions', isBuiltIn: true },
  { name: 'pr-comments', description: 'View PR comments for current branch', isBuiltIn: true },
  { name: 'review', description: 'Request code review', isBuiltIn: true },
  { name: 'rewind', description: 'Rewind conversation to previous state', isBuiltIn: true, isInteractive: true },
  { name: 'status', description: 'View account and system status', isBuiltIn: true },
  { name: 'terminal-setup', description: 'Install shell integration (Shift+Enter)', isBuiltIn: true },
  { name: 'vim', description: 'Enter vim mode for multi-line input', isBuiltIn: true },
];

// Parse frontmatter from markdown file
function parseFrontmatter(content: string): { description?: string; argumentHint?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter = match[1];
  const result: { description?: string; argumentHint?: string } = {};

  const descMatch = frontmatter.match(/description:\s*(.+)/);
  if (descMatch) result.description = descMatch[1].trim();

  const argMatch = frontmatter.match(/argument-hint:\s*(.+)/);
  if (argMatch) result.argumentHint = argMatch[1].trim();

  return result;
}

// Recursively scan directory for all .md files and build command list
function scanCommandsDir(dir: string, prefix: string = ''): CommandInfo[] {
  const commands: CommandInfo[] = [];

  try {
    const items = readdirSync(dir);

    for (const item of items) {
      const itemPath = join(dir, item);
      const stat = statSync(itemPath);

      if (stat.isFile() && item.endsWith('.md')) {
        const name = item.replace('.md', '');
        const fullName = prefix ? `${prefix}:${name}` : name;
        const content = readFileSync(itemPath, 'utf-8');
        const { description, argumentHint } = parseFrontmatter(content);

        commands.push({
          name: fullName,
          description: description || `Run /${fullName} command`,
          argumentHint,
        });
      } else if (stat.isDirectory()) {
        // Recursively scan subdirectory
        const subPrefix = prefix ? `${prefix}:${item}` : item;
        const subCommands = scanCommandsDir(itemPath, subPrefix);
        commands.push(...subCommands);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return commands;
}

// GET /api/commands - List available Claude commands (flat list)
export async function GET() {
  try {
    const commandsDir = join(homedir(), '.claude', 'commands');
    const userCommands = scanCommandsDir(commandsDir);

    // Combine built-in and user commands
    const commands = [...BUILTIN_COMMANDS, ...userCommands];

    // Sort by name
    commands.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(commands);
  } catch (error) {
    console.error('Failed to list commands:', error);
    return NextResponse.json(
      { error: 'Failed to list commands' },
      { status: 500 }
    );
  }
}
