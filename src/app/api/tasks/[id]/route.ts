import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { rm } from 'fs/promises';
import { join } from 'path';
import { UPLOADS_DIR } from '@/lib/file-utils';
import type { TaskStatus } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('TaskById');

// GET /api/tasks/[id] - Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .limit(1);

    if (task.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(task[0]);
  } catch (error) {
    log.error({ error }, 'Failed to fetch task');
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id] - Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, status, position, chatInit, lastModel } = body;

    if (!title && !description && !status && position === undefined && chatInit === undefined && lastModel === undefined) {
      return NextResponse.json(
        { error: 'At least one field is required' },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: Date.now(),
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (position !== undefined) updateData.position = position;
    if (chatInit !== undefined) updateData.chatInit = chatInit ? 1 : 0;
    if (lastModel !== undefined) updateData.lastModel = lastModel;

    const result = await db
      .update(schema.tasks)
      .set(updateData)
      .where(eq(schema.tasks.id, id));

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const updatedTask = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .limit(1);

    return NextResponse.json(updatedTask[0]);
  } catch (error) {
    log.error({ error }, 'Failed to update task');
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] - Partial update a task (alias for PUT)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
}

// DELETE /api/tasks/[id] - Delete a task and its uploaded files
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Query attempt IDs to clean up upload directories before DB cascade
    const attempts = await db
      .select({ id: schema.attempts.id })
      .from(schema.attempts)
      .where(eq(schema.attempts.taskId, id));

    // Delete physical upload files for each attempt
    for (const attempt of attempts) {
      const attemptDir = join(UPLOADS_DIR, attempt.id);
      try {
        await rm(attemptDir, { recursive: true, force: true });
      } catch {
        // Directory may not exist if no files were uploaded
      }
    }

    const result = await db
      .delete(schema.tasks)
      .where(eq(schema.tasks.id, id));

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    log.error({ error }, 'Failed to delete task');
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
