import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { query } from '@anthropic-ai/claude-agent-sdk';

const execFileAsync = promisify(execFile);

// Timeout for git commands (5 seconds)
const GIT_TIMEOUT = 5000;

// POST /api/git/generate-message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath } = body;

    if (!projectPath) {
      return NextResponse.json(
        { error: 'projectPath is required' },
        { status: 400 }
      );
    }

    // Validate project path exists and is a directory
    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
      return NextResponse.json(
        { error: 'Invalid project path' },
        { status: 400 }
      );
    }

    // Check if it's a git repository by running git status
    try {
      await execFileAsync('git', ['status'], {
        cwd: resolvedPath,
        timeout: GIT_TIMEOUT,
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Not a git repository' },
        { status: 400 }
      );
    }

    // Get staged diff
    let diffOutput: string;
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--cached'], {
        cwd: resolvedPath,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
        timeout: GIT_TIMEOUT,
      });
      diffOutput = stdout;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'ETIMEDOUT') {
        return NextResponse.json(
          { error: 'Git command timed out' },
          { status: 504 }
        );
      }
      console.error('Error getting git diff:', error);
      return NextResponse.json(
        { error: 'Failed to get git diff' },
        { status: 500 }
      );
    }

    // Check if there are staged changes
    if (!diffOutput || diffOutput.trim().length === 0) {
      return NextResponse.json(
        { error: 'No staged files to commit' },
        { status: 400 }
      );
    }

    // Count additions and deletions
    const { additions, deletions } = countDiffStats(diffOutput);

    // Build prompt for Claude
    const prompt = buildCommitMessagePrompt(diffOutput);

    // Call Claude SDK to generate commit message
    let generatedMessage: string;
    try {
      const response = query({
        prompt,
        options: {
          cwd: resolvedPath,
          model: 'sonnet',
          permissionMode: 'bypassPermissions' as const,
        },
      });

      let buffer = '';
      for await (const message of response) {
        // Handle streaming events
        if (message.type === 'stream_event') {
          const streamMsg = message as {
            type: 'stream_event';
            event: { type: string; delta?: { type: string; text?: string } }
          };
          const event = streamMsg.event;
          if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
            buffer += event.delta.text;
          }
        }

        // Handle assistant messages for non-streaming responses
        if (message.type === 'assistant') {
          const assistantMsg = message as {
            type: 'assistant';
            message?: { content: Array<{ type: string; text?: string }> }
          };
          const content = assistantMsg.message?.content || [];
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              if (!buffer.includes(block.text)) {
                buffer = block.text;
              }
            }
          }
        }
      }

      generatedMessage = extractCommitMessage(buffer);

      // Validate non-empty message
      if (!generatedMessage || generatedMessage.trim().length === 0) {
        console.error('Claude SDK returned empty message. Buffer:', buffer);
        return NextResponse.json(
          { error: 'Generated message was empty. Try staging different files.' },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('Error calling Claude SDK:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRateLimitError = errorMessage.toLowerCase().includes('rate limit');
      const isAuthError = errorMessage.toLowerCase().includes('api key') ||
                          errorMessage.toLowerCase().includes('unauthorized');

      return NextResponse.json(
        {
          error: isRateLimitError ? 'Rate limit exceeded. Try again later.' :
                 isAuthError ? 'API authentication failed. Check server configuration.' :
                 'Failed to generate commit message',
        },
        { status: isRateLimitError ? 429 : isAuthError ? 401 : 500 }
      );
    }

    return NextResponse.json({
      message: generatedMessage,
      diff: {
        additions,
        deletions,
      },
    });
  } catch (error: unknown) {
    console.error('Error generating commit message:', error);
    return NextResponse.json(
      { error: 'Failed to generate commit message' },
      { status: 500 }
    );
  }
}

/**
 * Build prompt for Claude to generate commit message
 */
function buildCommitMessagePrompt(diff: string): string {
  return `You are a git commit message generator. Analyze the following git diff and generate a concise, conventional commit message.

RULES:
1. Use conventional commit format: type(scope): description
2. Types: feat, fix, docs, style, refactor, test, chore
3. Keep under 72 characters
4. Be specific about what changed, not how
5. Output ONLY the commit message, no explanations

<git-diff>
${diff}
</git-diff>

Generate commit message:`;
}

/**
 * Extract commit message from Claude's response
 * Handles cases where Claude might add markdown fences or extra text
 */
function extractCommitMessage(response: string): string {
  let message = response.trim();

  // Remove markdown code fences if present
  const fenceMatch = message.match(/^```[\w]*\n?([\s\S]*?)```$/);
  if (fenceMatch) {
    message = fenceMatch[1].trim();
  }

  // Remove quotes if wrapped
  if (message.startsWith('"') && message.endsWith('"')) {
    message = message.slice(1, -1);
  }

  // Take first line if multi-line
  const firstLine = message.split('\n')[0].trim();

  return firstLine;
}

/**
 * Count diff statistics (additions and deletions)
 */
function countDiffStats(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  const lines = diff.split('\n');
  for (const line of lines) {
    // Skip diff headers
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('@@')) continue;
    if (line.startsWith('diff ')) continue;
    if (line.startsWith('index ')) continue;

    // Count additions (lines starting with +)
    if (line.startsWith('+')) {
      additions++;
    }
    // Count deletions (lines starting with -)
    else if (line.startsWith('-')) {
      deletions++;
    }
  }

  return { additions, deletions };
}
