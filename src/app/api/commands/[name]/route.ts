import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface CommandParams {
  params: Promise<{ name: string }>;
}

// Parse frontmatter and get body content
function parseCommand(content: string): {
  description?: string;
  argumentHint?: string;
  body: string;
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/);

  if (!frontmatterMatch) {
    return { body: content };
  }

  const frontmatter = frontmatterMatch[1];
  const body = frontmatterMatch[2].trim();

  const result: { description?: string; argumentHint?: string; body: string } = { body };

  const descMatch = frontmatter.match(/description:\s*(.+)/);
  if (descMatch) result.description = descMatch[1].trim();

  const argMatch = frontmatter.match(/argument-hint:\s*(.+)/);
  if (argMatch) result.argumentHint = argMatch[1].trim();

  return result;
}

// GET /api/commands/[name] - Get command content
export async function GET(
  request: NextRequest,
  { params }: CommandParams
) {
  try {
    const { name } = await params;
    const searchParams = request.nextUrl.searchParams;
    const subcommand = searchParams.get('subcommand');

    const commandsDir = join(homedir(), '.claude', 'commands');

    let filePath: string;
    if (subcommand) {
      filePath = join(commandsDir, name, `${subcommand}.md`);
    } else {
      filePath = join(commandsDir, `${name}.md`);
    }

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Command not found' },
        { status: 404 }
      );
    }

    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseCommand(content);

    return NextResponse.json({
      name: subcommand ? `${name}:${subcommand}` : name,
      ...parsed,
    });
  } catch (error) {
    console.error('Failed to get command:', error);
    return NextResponse.json(
      { error: 'Failed to get command' },
      { status: 500 }
    );
  }
}

// POST /api/commands/[name] - Process command with arguments
export async function POST(
  request: NextRequest,
  { params }: CommandParams
) {
  try {
    const { name } = await params;
    const body = await request.json();
    const { arguments: args, subcommand } = body;

    const commandsDir = join(homedir(), '.claude', 'commands');

    let filePath: string;
    if (subcommand) {
      filePath = join(commandsDir, name, `${subcommand}.md`);
    } else {
      filePath = join(commandsDir, `${name}.md`);
    }

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Command not found' },
        { status: 404 }
      );
    }

    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseCommand(content);

    // Replace $ARGUMENTS placeholder with actual arguments
    let processedPrompt = parsed.body;
    if (args) {
      processedPrompt = processedPrompt.replace(/\$ARGUMENTS/g, args);
    } else {
      // Remove $ARGUMENTS if no args provided
      processedPrompt = processedPrompt.replace(/\$ARGUMENTS/g, '');
    }

    return NextResponse.json({
      name: subcommand ? `${name}:${subcommand}` : name,
      prompt: processedPrompt.trim(),
    });
  } catch (error) {
    console.error('Failed to process command:', error);
    return NextResponse.json(
      { error: 'Failed to process command' },
      { status: 500 }
    );
  }
}
