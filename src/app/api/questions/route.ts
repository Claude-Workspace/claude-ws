import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/lib/agent-manager';
import { db, schema } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';

// GET /api/questions - Get all pending questions across running attempts
// Optional query param: ?projectIds=id1,id2 to filter by project
export async function GET(request: NextRequest) {
  try {
    const allPending = agentManager.getAllPendingQuestions();

    if (allPending.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    // Look up attemptId → taskId → projectId from DB
    const attemptIds = allPending.map((p) => p.attemptId);
    const attempts = await db.query.attempts.findMany({
      where: inArray(schema.attempts.id, attemptIds),
    });

    const attemptMap = new Map(attempts.map((a) => [a.id, a]));

    // Get task info for all relevant tasks
    const taskIds = [...new Set(attempts.map((a) => a.taskId))];
    const tasks = taskIds.length > 0
      ? await db.query.tasks.findMany({
          where: inArray(schema.tasks.id, taskIds),
        })
      : [];
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    // Filter by projectIds if provided
    const projectIdsParam = request.nextUrl.searchParams.get('projectIds');
    const filterProjectIds = projectIdsParam ? projectIdsParam.split(',').filter(Boolean) : null;

    const questions = allPending
      .map((pending) => {
        const attempt = attemptMap.get(pending.attemptId);
        if (!attempt) return null;
        const task = taskMap.get(attempt.taskId);
        if (!task) return null;

        return {
          attemptId: pending.attemptId,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          toolUseId: pending.toolUseId,
          questions: pending.questions,
          timestamp: pending.timestamp,
        };
      })
      .filter((q): q is NonNullable<typeof q> => {
        if (!q) return false;
        if (filterProjectIds && !filterProjectIds.includes(q.projectId)) return false;
        return true;
      });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error getting pending questions:', error);
    return NextResponse.json(
      { error: 'Failed to get pending questions' },
      { status: 500 }
    );
  }
}
