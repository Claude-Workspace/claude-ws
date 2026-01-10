import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';

// GET /api/tasks/[id]/attempts - List attempts for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    // Verify task exists
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Fetch attempts for this task
    const attempts = await db.query.attempts.findMany({
      where: eq(schema.attempts.taskId, taskId),
      orderBy: [desc(schema.attempts.createdAt)],
    });

    return NextResponse.json({ attempts });
  } catch (error) {
    console.error('Error fetching attempts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attempts' },
      { status: 500 }
    );
  }
}
