import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import type { ClaudeOutput } from '@/types';

interface ConversationTurn {
  type: 'user' | 'assistant';
  prompt?: string;
  messages: ClaudeOutput[];
  attemptId: string;
  timestamp: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    // Get all attempts for this task, ordered by creation time
    const attempts = await db.query.attempts.findMany({
      where: eq(schema.attempts.taskId, taskId),
      orderBy: [asc(schema.attempts.createdAt)],
    });

    const turns: ConversationTurn[] = [];

    for (const attempt of attempts) {
      // Add user turn (show displayPrompt if available, otherwise fall back to prompt)
      turns.push({
        type: 'user',
        prompt: attempt.displayPrompt || attempt.prompt,
        messages: [],
        attemptId: attempt.id,
        timestamp: attempt.createdAt,
      });

      // Get all JSON logs for this attempt
      const logs = await db.query.attemptLogs.findMany({
        where: eq(schema.attemptLogs.attemptId, attempt.id),
        orderBy: [asc(schema.attemptLogs.createdAt)],
      });

      // Parse JSON logs into messages
      const messages: ClaudeOutput[] = [];
      for (const log of logs) {
        if (log.type === 'json') {
          try {
            const parsed = JSON.parse(log.content) as ClaudeOutput;
            // Skip system messages (they contain session_id but no useful content for display)
            if (parsed.type !== 'system') {
              messages.push(parsed);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // Add assistant turn if there are messages
      if (messages.length > 0) {
        turns.push({
          type: 'assistant',
          messages,
          attemptId: attempt.id,
          timestamp: attempt.createdAt,
        });
      }
    }

    return NextResponse.json({ turns });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}
