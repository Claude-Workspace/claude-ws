import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { nanoid } from 'nanoid';

// POST /api/attempts - Create a new attempt (only creates record)
// Actual execution happens via WebSocket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, prompt } = body;

    if (!taskId || !prompt) {
      return NextResponse.json(
        { error: 'taskId and prompt are required' },
        { status: 400 }
      );
    }

    const newAttempt = {
      id: nanoid(),
      taskId,
      prompt,
      status: 'running' as const,
      branch: null,
      diffAdditions: 0,
      diffDeletions: 0,
      createdAt: Date.now(),
      completedAt: null,
    };

    await db.insert(schema.attempts).values(newAttempt);

    return NextResponse.json(newAttempt, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create attempt:', error);

    // Handle foreign key constraint (invalid taskId)
    if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create attempt' },
      { status: 500 }
    );
  }
}
