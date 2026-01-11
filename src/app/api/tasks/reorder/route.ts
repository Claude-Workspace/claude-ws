import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { TaskStatus } from '@/types';

interface ReorderItem {
  id: string;
  status: TaskStatus;
  position: number;
}

const validStatuses: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];

// PUT /api/tasks/reorder - Reorder single task
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, status, position } = body as { taskId: string; status: TaskStatus; position: number };

    if (!taskId || !status || position === undefined) {
      return NextResponse.json(
        { error: 'taskId, status, and position are required' },
        { status: 400 }
      );
    }

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status value: ${status}` },
        { status: 400 }
      );
    }

    const result = await db
      .update(schema.tasks)
      .set({
        status,
        position,
        updatedAt: Date.now(),
      })
      .where(eq(schema.tasks.id, taskId));

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder task:', error);
    return NextResponse.json(
      { error: 'Failed to reorder task' },
      { status: 500 }
    );
  }
}

// POST /api/tasks/reorder - Reorder tasks (batch update)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tasks } = body as { tasks: ReorderItem[] };

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'tasks array is required' },
        { status: 400 }
      );
    }

    // Validate all items
    for (const task of tasks) {
      if (!task.id || !task.status || task.position === undefined) {
        return NextResponse.json(
          { error: 'Each task must have id, status, and position' },
          { status: 400 }
        );
      }
      if (!validStatuses.includes(task.status)) {
        return NextResponse.json(
          { error: `Invalid status value: ${task.status}` },
          { status: 400 }
        );
      }
    }

    // Update all tasks in a transaction-like manner
    // Note: better-sqlite3 is synchronous, so we can do sequential updates safely
    const updatedAt = Date.now();
    const errors: string[] = [];

    for (const task of tasks) {
      try {
        const result = await db
          .update(schema.tasks)
          .set({
            status: task.status,
            position: task.position,
            updatedAt,
          })
          .where(eq(schema.tasks.id, task.id));

        if (result.changes === 0) {
          errors.push(`Task ${task.id} not found`);
        }
      } catch (error) {
        console.error(`Failed to update task ${task.id}:`, error);
        errors.push(`Failed to update task ${task.id}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Some tasks failed to update',
          details: errors,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      success: true,
      updated: tasks.length,
    });
  } catch (error) {
    console.error('Failed to reorder tasks:', error);
    return NextResponse.json(
      { error: 'Failed to reorder tasks' },
      { status: 500 }
    );
  }
}
