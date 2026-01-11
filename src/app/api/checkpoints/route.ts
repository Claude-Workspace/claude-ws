import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';

// GET /api/checkpoints?taskId=xxx
// Returns checkpoints for a task, ordered by createdAt desc
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    // Get checkpoints with attempt info
    const results = await db
      .select({
        id: schema.checkpoints.id,
        taskId: schema.checkpoints.taskId,
        attemptId: schema.checkpoints.attemptId,
        sessionId: schema.checkpoints.sessionId,
        messageCount: schema.checkpoints.messageCount,
        summary: schema.checkpoints.summary,
        createdAt: schema.checkpoints.createdAt,
        attemptDisplayPrompt: schema.attempts.displayPrompt,
        attemptPrompt: schema.attempts.prompt,
      })
      .from(schema.checkpoints)
      .leftJoin(schema.attempts, eq(schema.checkpoints.attemptId, schema.attempts.id))
      .where(eq(schema.checkpoints.taskId, taskId))
      .orderBy(desc(schema.checkpoints.createdAt));

    // Transform to match expected format
    const checkpoints = results.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      attemptId: r.attemptId,
      sessionId: r.sessionId,
      messageCount: r.messageCount,
      summary: r.summary,
      createdAt: r.createdAt,
      attempt: {
        displayPrompt: r.attemptDisplayPrompt,
        prompt: r.attemptPrompt,
      },
    }));

    return NextResponse.json(checkpoints);
  } catch (error) {
    console.error('Failed to fetch checkpoints:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checkpoints' },
      { status: 500 }
    );
  }
}
