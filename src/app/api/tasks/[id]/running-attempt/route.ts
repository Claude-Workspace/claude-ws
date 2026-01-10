import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, asc } from 'drizzle-orm';

// GET /api/tasks/[id]/running-attempt - Get currently running attempt for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    // Find running attempt for this task
    const runningAttempt = await db.query.attempts.findFirst({
      where: and(
        eq(schema.attempts.taskId, taskId),
        eq(schema.attempts.status, 'running')
      ),
    });

    if (!runningAttempt) {
      return NextResponse.json({ attempt: null, messages: [] });
    }

    // Get all JSON logs for this attempt so far
    const logs = await db.query.attemptLogs.findMany({
      where: eq(schema.attemptLogs.attemptId, runningAttempt.id),
      orderBy: [asc(schema.attemptLogs.createdAt)],
    });

    // Parse logs into messages
    const messages = [];
    for (const log of logs) {
      if (log.type === 'json') {
        try {
          const parsed = JSON.parse(log.content);
          if (parsed.type !== 'system') {
            messages.push(parsed);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return NextResponse.json({
      attempt: {
        id: runningAttempt.id,
        prompt: runningAttempt.displayPrompt || runningAttempt.prompt,
        status: runningAttempt.status,
      },
      messages,
    });
  } catch (error) {
    console.error('Error fetching running attempt:', error);
    return NextResponse.json(
      { error: 'Failed to fetch running attempt' },
      { status: 500 }
    );
  }
}
