import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { query } from '@anthropic-ai/claude-agent-sdk';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

// Timeout for git commands (5 seconds)
const GIT_TIMEOUT = 5000;

// Max diff size to send to AI (50KB of actual diff content)
const MAX_DIFF_SIZE = 50 * 1024;

// In-memory cache for commit messages (24hr TTL)
const commitMessageCache = new Map<string, { data: any; expiresAt: number }>();

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

    // Get diff of all changes (both staged and unstaged) - PARALLEL for speed
    let diffOutput: string;
    try {
      // Run both git commands in parallel for faster execution
      const [stagedResult, unstagedResult] = await Promise.all([
        execFileAsync('git', ['diff', '--cached'], {
          cwd: resolvedPath,
          maxBuffer: 10 * 1024 * 1024,
          timeout: GIT_TIMEOUT,
        }),
        execFileAsync('git', ['diff'], {
          cwd: resolvedPath,
          maxBuffer: 10 * 1024 * 1024,
          timeout: GIT_TIMEOUT,
        }),
      ]);

      // Combine both diffs
      diffOutput = stagedResult.stdout + unstagedResult.stdout;
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

    // Create hash of diff for caching
    const diffHash = crypto.createHash('md5').update(diffOutput).digest('hex');

    // Check cache first (24hr TTL)
    const cached = commitMessageCache.get(diffHash);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('[CommitMessage] Cache hit for diff hash:', diffHash);
      return NextResponse.json(cached.data);
    }

    // Check if there are any changes
    if (!diffOutput || diffOutput.trim().length === 0) {
      return NextResponse.json(
        { error: 'No changes to generate commit message for' },
        { status: 400 }
      );
    }

    // Count additions and deletions
    const { additions, deletions } = countDiffStats(diffOutput);

    // Smart diff truncation - only send first N KB to AI
    const truncatedDiff = truncateDiff(diffOutput, MAX_DIFF_SIZE);
    const wasTruncated = truncatedDiff.length < diffOutput.length;

    // Build prompt for Claude
    const prompt = buildCommitMessagePrompt(truncatedDiff, wasTruncated);

    // Call Claude SDK to generate commit message
    try {
      const response = query({
        prompt,
        options: {
          cwd: resolvedPath,
          model: 'haiku',
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

      const { title, description } = extractCommitMessage(buffer);

      // Validate non-empty title
      if (!title || title.trim().length === 0) {
        console.error('Claude SDK returned empty title. Buffer:', buffer);
        return NextResponse.json(
          { error: 'Generated message was empty. Try staging different files.' },
          { status: 500 }
        );
      }

      const responseData = {
        title,
        description,
        message: title, // backwards compatibility
        diff: {
          additions,
          deletions,
        },
      };

      // Cache the result for 24 hours
      commitMessageCache.set(diffHash, {
        data: responseData,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
      });

      // Clean up old cache entries periodically
      if (commitMessageCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of commitMessageCache.entries()) {
          if (value.expiresAt < now) {
            commitMessageCache.delete(key);
          }
        }
      }

      return NextResponse.json(responseData);
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
  } catch (error: unknown) {
    console.error('Error generating commit message:', error);
    return NextResponse.json(
      { error: 'Failed to generate commit message' },
      { status: 500 }
    );
  }
}

/**
 * Truncate diff to max size while preserving file structure
 * Keeps file headers and truncates content uniformly
 */
function truncateDiff(diff: string, maxSize: number): string {
  if (diff.length <= maxSize) return diff;

  // Calculate truncation ratio
  const ratio = maxSize / diff.length;

  // Split into hunks (preserve diff structure)
  const lines = diff.split('\n');
  const result: string[] = [];
  let currentSize = 0;

  // Keep file headers intact, truncate content
  let inHunk = false;
  let hunkLines: string[] = [];
  const targetHunkSize = Math.floor(200 * ratio); // Target lines per hunk

  for (const line of lines) {
    // Always keep diff headers
    if (line.startsWith('diff ') ||
        line.startsWith('index ') ||
        line.match(/^---\s/) ||
        line.match(/^\+\+\+\s/) ||
        line.startsWith('@@')) {
      if (hunkLines.length > 0) {
        result.push(...hunkLines.slice(0, targetHunkSize));
        hunkLines = [];
      }
      result.push(line);
      inHunk = line.startsWith('@@');
      currentSize += line.length + 1;
      continue;
    }

    if (inHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      hunkLines.push(line);
      if (hunkLines.length <= targetHunkSize) {
        currentSize += line.length + 1;
      }
      continue;
    }

    // Empty line between hunks
    if (line === '' && hunkLines.length > 0) {
      result.push(...hunkLines.slice(0, targetHunkSize));
      hunkLines = [];
      result.push(line);
      inHunk = false;
      continue;
    }
  }

  // Add remaining hunk
  if (hunkLines.length > 0) {
    result.push(...hunkLines.slice(0, targetHunkSize));
  }

  return result.join('\n');
}

/**
 * Build prompt for Claude to generate commit message with title and description
 */
function buildCommitMessagePrompt(diff: string, wasTruncated: boolean): string {
  const truncationNote = wasTruncated ?
    '\n\nNOTE: Diff is truncated for performance. Focus on visible patterns.\n' : '';

  return `Generate a git commit message with title and description.${truncationNote}

TITLE RULES:
- Format: type(scope): description
- Types: feat, fix, docs, style, refactor, test, chore
- Max 72 characters
- Be specific about what changed

DESCRIPTION RULES:
- Use bullet points with "-" prefix
- List files/components changed and their modifications
- Focus on WHAT changed and its IMPACT
- Be concise and technical
- NO introductory sentences like "This commit introduces..."
- NO concluding sentences like "These changes improve..."
- Just the facts: file changes, features added/modified, breaking changes

EXAMPLE OUTPUT:
TITLE: feat(auth): add JWT token refresh mechanism
DESCRIPTION:
- auth-service.ts: add refreshToken() method with 7-day expiry
- auth-middleware.ts: check token expiry before each request
- user-store.ts: persist refresh token in localStorage
- Breaking: removed deprecated session-based auth

OUTPUT FORMAT:
TITLE: <commit title>
DESCRIPTION:
<bullet points>

<git-diff>
${diff}
</git-diff>`;
}

/**
 * Extract commit title and description from Claude's response
 * Handles cases where Claude might add markdown fences or extra text
 */
function extractCommitMessage(response: string): { title: string; description: string } {
  let message = response.trim();

  // Remove markdown code fences if present
  const fenceMatch = message.match(/^```[\w]*\n?([\s\S]*?)```$/);
  if (fenceMatch) {
    message = fenceMatch[1].trim();
  }

  // Parse TITLE: and DESCRIPTION: format
  const titleMatch = message.match(/TITLE:\s*(.+?)(?:\n|$)/i);
  const descriptionMatch = message.match(/DESCRIPTION:\s*([\s\S]*?)$/i);

  let title = '';
  let description = '';

  if (titleMatch) {
    title = titleMatch[1].trim();
    // Remove quotes if wrapped
    if (title.startsWith('"') && title.endsWith('"')) {
      title = title.slice(1, -1);
    }
  } else {
    // Fallback: use first line as title
    title = message.split('\n')[0].trim();
    if (title.startsWith('"') && title.endsWith('"')) {
      title = title.slice(1, -1);
    }
  }

  if (descriptionMatch) {
    description = descriptionMatch[1].trim();
    // Clean up description - remove TITLE part if included
    description = description.replace(/^TITLE:.*?\n/i, '').trim();
  }

  return { title, description };
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
