import { NextResponse } from 'next/server';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface CommandInfo {
  name: string;
  description: string;
  argumentHint?: string;
  hasSubcommands: boolean;
  subcommands?: string[];
}

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

// GET /api/commands - List available Claude commands
export async function GET() {
  try {
    const commandsDir = join(homedir(), '.claude', 'commands');
    const commands: CommandInfo[] = [];

    const items = readdirSync(commandsDir);

    for (const item of items) {
      const itemPath = join(commandsDir, item);
      const stat = statSync(itemPath);

      if (stat.isFile() && item.endsWith('.md')) {
        // Root command file
        const name = item.replace('.md', '');
        const content = readFileSync(itemPath, 'utf-8');
        const { description, argumentHint } = parseFrontmatter(content);

        // Check if there's a matching directory with subcommands
        const dirPath = join(commandsDir, name);
        let hasSubcommands = false;
        let subcommands: string[] = [];

        try {
          const dirStat = statSync(dirPath);
          if (dirStat.isDirectory()) {
            hasSubcommands = true;
            const subItems = readdirSync(dirPath);
            subcommands = subItems
              .filter((f) => f.endsWith('.md'))
              .map((f) => f.replace('.md', ''));
          }
        } catch {
          // Directory doesn't exist
        }

        commands.push({
          name,
          description: description || `Run /${name} command`,
          argumentHint,
          hasSubcommands,
          subcommands: hasSubcommands ? subcommands : undefined,
        });
      }
    }

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
