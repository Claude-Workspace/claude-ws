import { NextResponse } from 'next/server';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getClaudeHomeDir } from '@/lib/agent-factory-dir';

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
function parseFrontmatter(content: string): { description?: string; argumentHint?: string; name?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter = match[1];
  const result: { description?: string; argumentHint?: string; name?: string } = {};

  const descMatch = frontmatter.match(/description:\s*(.+)/);
  if (descMatch) result.description = descMatch[1].trim().replace(/^["']|["']$/g, '');

  const argMatch = frontmatter.match(/argument-hint:\s*(.+)/);
  if (argMatch) result.argumentHint = argMatch[1].trim().replace(/^["']|["']$/g, '');

  const nameMatch = frontmatter.match(/name:\s*(.+)/);
  if (nameMatch) result.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');

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

// Scan skills directory for SKILL.md files
function scanSkillsDir(dir: string): CommandInfo[] {
  const skills: CommandInfo[] = [];

  try {
    if (!existsSync(dir)) return skills;

    const items = readdirSync(dir);

    for (const item of items) {
      const itemPath = join(dir, item);
      const stat = statSync(itemPath);

      if (stat.isDirectory()) {
        // Check for SKILL.md in this directory
        const skillFile = join(itemPath, 'SKILL.md');
        if (existsSync(skillFile)) {
          const content = readFileSync(skillFile, 'utf-8');
          const { description, argumentHint, name } = parseFrontmatter(content);

          skills.push({
            name: name || item,
            description: description || `Run /${item} skill`,
            argumentHint,
          });
        } else {
          // Recursively scan subdirectory
          const subSkills = scanSkillsDir(itemPath);
          skills.push(...subSkills);
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return skills;
}

// GET /api/commands - List available Claude commands (flat list)
export async function GET() {
  try {
    const claudeHomeDir = getClaudeHomeDir();

    // Scan commands directory
    const commandsDir = join(homedir(), '.claude', 'commands');
    const userCommands = scanCommandsDir(commandsDir);

    // Scan skills directories
    const skillsDirs = [
      join(claudeHomeDir, 'skills'),           // ~/.claude/skills/
      join(claudeHomeDir, 'agent-factory', 'skills'), // ~/.claude/agent-factory/skills/
    ];

    const skills: CommandInfo[] = [];
    for (const skillsDir of skillsDirs) {
      const dirSkills = scanSkillsDir(skillsDir);
      // Avoid duplicates by name
      for (const skill of dirSkills) {
        if (!skills.some(s => s.name === skill.name)) {
          skills.push(skill);
        }
      }
    }

    // Combine built-in commands, user commands, and skills
    const commands = [...BUILTIN_COMMANDS, ...userCommands, ...skills];

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
