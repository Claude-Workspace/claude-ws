import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    // Get all attempts for this task
    const attempts = await db.query.attempts.findMany({
      where: eq(schema.attempts.taskId, taskId),
      orderBy: [desc(schema.attempts.createdAt)],
    });

    // Aggregate stats from all attempts
    let totalTokens = 0;
    let totalCostUSD = 0;
    let totalTurns = 0;
    let totalDurationMs = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;
    let filesChanged = 0;
    let contextUsed = 0;
    let contextLimit = 200000;
    let contextPercentage = 0;

    for (const attempt of attempts) {
      totalTokens += attempt.totalTokens || 0;
      totalCostUSD += parseFloat(attempt.totalCostUSD || '0');
      totalTurns += attempt.numTurns || 0;
      totalDurationMs += attempt.durationMs || 0;
      totalAdditions += attempt.diffAdditions || 0;
      totalDeletions += attempt.diffDeletions || 0;
      if ((attempt.diffAdditions || 0) > 0 || (attempt.diffDeletions || 0) > 0) {
        filesChanged++;
      }
      // Use latest attempt's context data (most recent)
      if (attempt.contextUsed && attempt.contextUsed > contextUsed) {
        contextUsed = attempt.contextUsed;
        contextLimit = attempt.contextLimit || 200000;
        contextPercentage = attempt.contextPercentage || 0;
      }
    }

    return NextResponse.json({
      totalTokens,
      totalCostUSD,
      totalTurns,
      totalDurationMs,
      totalAdditions,
      totalDeletions,
      filesChanged,
      contextUsed,
      contextLimit,
      contextPercentage,
      attemptCount: attempts.length,
      lastUpdatedAt: attempts[0]?.completedAt || Date.now(),
    });
  } catch (error) {
    console.error('Error getting task stats:', error);
    return NextResponse.json(
      { error: 'Failed to get task stats' },
      { status: 500 }
    );
  }
}
