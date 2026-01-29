import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, like, or, and, inArray } from 'drizzle-orm';

/**
 * Search chat history for matching text across all tasks.
 * Returns task IDs and matched snippets for display in search results.
 */

interface ChatHistoryMatch {
  taskId: string;
  matchedText: string; // The matched sentence/context
  source: 'prompt' | 'assistant'; // Where the match was found
  attemptId: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const projectId = searchParams.get('projectId');
    const projectIds = searchParams.get('projectIds'); // Comma-separated

    if (!query || query.length < 2) {
      return NextResponse.json({ matches: [] });
    }

    const queryLower = query.toLowerCase();

    // Parse project IDs
    const projectIdList: string[] = [];
    if (projectIds) {
      projectIdList.push(...projectIds.split(',').filter(Boolean));
    } else if (projectId) {
      projectIdList.push(projectId);
    }

    // Get all tasks for the project(s)
    let tasksQuery;
    if (projectIdList.length > 0) {
      tasksQuery = await db.query.tasks.findMany({
        where: inArray(schema.tasks.projectId, projectIdList),
        columns: { id: true, projectId: true },
      });
    } else {
      tasksQuery = await db.query.tasks.findMany({
        columns: { id: true, projectId: true },
      });
    }

    const taskIds = tasksQuery.map(t => t.id);
    if (taskIds.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const taskMatchMap = new Map<string, ChatHistoryMatch>(); // Only keep first match per task

    // Search in attempts (user prompts)
    const promptMatches = await db.query.attempts.findMany({
      where: and(
        inArray(schema.attempts.taskId, taskIds),
        or(
          like(schema.attempts.prompt, `%${query}%`),
          like(schema.attempts.displayPrompt, `%${query}%`)
        )
      ),
      columns: {
        id: true,
        taskId: true,
        prompt: true,
        displayPrompt: true,
      },
      limit: 50,
    });

    for (const attempt of promptMatches) {
      if (taskMatchMap.has(attempt.taskId)) continue;

      const searchText = attempt.displayPrompt || attempt.prompt;
      const matchedSnippet = extractMatchSnippet(searchText, queryLower);

      if (matchedSnippet) {
        taskMatchMap.set(attempt.taskId, {
          taskId: attempt.taskId,
          matchedText: matchedSnippet,
          source: 'prompt',
          attemptId: attempt.id,
        });
      }
    }

    // Search in attempt logs (assistant responses)
    // Get attempts for our tasks
    const attemptIds = await db.query.attempts.findMany({
      where: inArray(schema.attempts.taskId, taskIds),
      columns: { id: true, taskId: true },
    });

    const attemptToTaskMap = new Map(attemptIds.map(a => [a.id, a.taskId]));
    const allAttemptIds = attemptIds.map(a => a.id);

    if (allAttemptIds.length > 0) {
      // Search in logs content (JSON contains text blocks)
      const logMatches = await db.query.attemptLogs.findMany({
        where: and(
          inArray(schema.attemptLogs.attemptId, allAttemptIds),
          eq(schema.attemptLogs.type, 'json'),
          like(schema.attemptLogs.content, `%${query}%`)
        ),
        columns: {
          id: true,
          attemptId: true,
          content: true,
        },
        limit: 100,
      });

      for (const log of logMatches) {
        const taskId = attemptToTaskMap.get(log.attemptId);
        if (!taskId || taskMatchMap.has(taskId)) continue;

        // Parse the JSON content to extract text
        try {
          const parsed = JSON.parse(log.content);
          let textContent = '';

          // Handle assistant messages with content blocks
          if (parsed.type === 'assistant' && parsed.message?.content) {
            for (const block of parsed.message.content) {
              if (block.type === 'text' && block.text) {
                textContent += block.text + ' ';
              }
            }
          }

          if (textContent) {
            const matchedSnippet = extractMatchSnippet(textContent, queryLower);
            if (matchedSnippet) {
              taskMatchMap.set(taskId, {
                taskId,
                matchedText: matchedSnippet,
                source: 'assistant',
                attemptId: log.attemptId,
              });
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return NextResponse.json({
      matches: Array.from(taskMatchMap.values()),
      query,
    });
  } catch (error) {
    console.error('Error searching chat history:', error);
    return NextResponse.json(
      { error: 'Failed to search chat history' },
      { status: 500 }
    );
  }
}

/**
 * Extract a snippet of text around the matched query.
 * Returns ~100 chars of context around the match.
 */
function extractMatchSnippet(text: string, queryLower: string): string | null {
  const textLower = text.toLowerCase();
  const matchIndex = textLower.indexOf(queryLower);

  if (matchIndex === -1) return null;

  const contextChars = 40;
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(text.length, matchIndex + queryLower.length + contextChars);

  let snippet = text.substring(start, end).trim();

  // Add ellipsis if truncated
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  // Clean up whitespace
  snippet = snippet.replace(/\s+/g, ' ');

  return snippet;
}
