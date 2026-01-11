import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, gt } from 'drizzle-orm';

// POST /api/checkpoints/rewind
// Body: { checkpointId: string }
// Deletes all attempts/logs/checkpoints after this checkpoint
// Returns the checkpoint's sessionId for resuming
export async function POST(request: Request) {
  try {
    const { checkpointId } = await request.json();

    if (!checkpointId) {
      return NextResponse.json({ error: 'checkpointId required' }, { status: 400 });
    }

    // Get the checkpoint
    const checkpoint = await db.query.checkpoints.findFirst({
      where: eq(schema.checkpoints.id, checkpointId),
    });

    if (!checkpoint) {
      return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 });
    }

    // Get all attempts after this checkpoint for the same task
    const laterAttempts = await db.query.attempts.findMany({
      where: and(
        eq(schema.attempts.taskId, checkpoint.taskId),
        gt(schema.attempts.createdAt, checkpoint.createdAt)
      ),
    });

    // Delete later attempts (cascades to logs and checkpoints)
    for (const attempt of laterAttempts) {
      await db.delete(schema.attempts).where(eq(schema.attempts.id, attempt.id));
    }

    // Delete checkpoints after this one (same task)
    await db.delete(schema.checkpoints).where(
      and(
        eq(schema.checkpoints.taskId, checkpoint.taskId),
        gt(schema.checkpoints.createdAt, checkpoint.createdAt)
      )
    );

    return NextResponse.json({
      success: true,
      sessionId: checkpoint.sessionId,
      taskId: checkpoint.taskId,
      attemptId: checkpoint.attemptId,
    });
  } catch (error) {
    console.error('Failed to rewind checkpoint:', error);
    return NextResponse.json(
      { error: 'Failed to rewind checkpoint' },
      { status: 500 }
    );
  }
}
