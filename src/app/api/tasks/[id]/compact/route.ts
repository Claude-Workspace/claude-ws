import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { agentManager } from '@/lib/agent-manager';
import { sessionManager } from '@/lib/session-manager';
import { createLogger } from '@/lib/logger';

const log = createLogger('CompactTask');

// POST /api/tasks/[id]/compact - Trigger conversation compaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId),
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, task.projectId),
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const conversationSummary = await sessionManager.getConversationSummary(taskId);

    const attemptId = nanoid();
    await db.insert(schema.attempts).values({
      id: attemptId,
      taskId,
      prompt: 'Compact: summarize conversation context',
      displayPrompt: 'Compacting conversation...',
      status: 'running',
    });

    log.info({ attemptId, taskId }, 'Starting compact');

    agentManager.compact({
      attemptId,
      projectPath: project.path,
      conversationSummary,
    });

    return NextResponse.json({ success: true, attemptId });
  } catch (error) {
    log.error({ error }, 'Failed to compact');
    return NextResponse.json(
      { error: 'Failed to compact conversation' },
      { status: 500 }
    );
  }
}
