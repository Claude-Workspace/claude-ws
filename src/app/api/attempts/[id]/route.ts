import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import { formatOutput } from '@/lib/output-formatter';
import type { ClaudeOutput, OutputFormat } from '@/types';

// GET /api/attempts/[id] - Get attempt with logs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the attempt
    const attempt = await db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.id, id))
      .limit(1);

    if (attempt.length === 0) {
      return NextResponse.json(
        { error: 'Attempt not found' },
        { status: 404 }
      );
    }

    const attemptData = attempt[0];

    // Fetch logs for this attempt
    const logs = await db
      .select()
      .from(schema.attemptLogs)
      .where(eq(schema.attemptLogs.attemptId, id))
      .orderBy(schema.attemptLogs.createdAt);

    // If no outputFormat specified or it's 'json', return original structure (backward compatible)
    if (!attemptData.outputFormat || attemptData.outputFormat === 'json') {
      return NextResponse.json({
        ...attemptData,
        logs,
      });
    }

    // Parse JSON logs into ClaudeOutput messages
    const messages: ClaudeOutput[] = logs
      .filter(log => log.type === 'json')
      .map(log => {
        try {
          return JSON.parse(log.content) as ClaudeOutput;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ClaudeOutput[];

    // Format according to the stored outputFormat
    const formatted = formatOutput(
      messages,
      attemptData.outputFormat as OutputFormat,
      attemptData.outputSchema,
      {
        id: attemptData.id,
        taskId: attemptData.taskId,
        prompt: attemptData.prompt,
        status: attemptData.status,
        createdAt: attemptData.createdAt,
        completedAt: attemptData.completedAt
      }
    );

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Failed to fetch attempt:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attempt' },
      { status: 500 }
    );
  }
}
