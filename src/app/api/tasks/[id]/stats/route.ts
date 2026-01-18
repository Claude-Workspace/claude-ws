import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { calculateContextHealth } from '@/lib/context-health';

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

    // Context usage: Use LATEST attempt with actual context data
    // When a new turn starts, the latest attempt may have 0 context (not yet updated)
    // In that case, fall back to the previous completed attempt's context
    const latestAttempt = attempts[0]; // Already ordered by createdAt DESC

    // If latest attempt is running and has no context data yet, use previous attempt's context
    let contextUsed = latestAttempt?.contextUsed || 0;
    let contextLimit = latestAttempt?.contextLimit || 200000;
    let contextPercentage = latestAttempt?.contextPercentage || 0;

    // Fallback to previous attempt if current is running with no context data
    if (latestAttempt?.status === 'running' && contextPercentage === 0 && attempts.length > 1) {
      const previousAttempt = attempts[1];
      if (previousAttempt?.contextPercentage && previousAttempt.contextPercentage > 0) {
        contextUsed = previousAttempt.contextUsed || 0;
        contextLimit = previousAttempt.contextLimit || 200000;
        contextPercentage = previousAttempt.contextPercentage;
        console.log(`[Stats] Using previous attempt context: ${contextPercentage}% (current attempt is running with no data)`);
      }
    }

    // Calculate context health metrics (ClaudeKit formulas)
    // Note: We approximate input/output split since DB only stores total contextUsed
    // For stats API, we use contextUsed as total and calculate health accordingly
    const contextHealth = calculateContextHealth(
      contextUsed, // Using total as input approximation
      0,           // Output already included in contextUsed from usage-tracker
      contextLimit
    );

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
      contextHealth: {
        status: contextHealth.status,
        score: contextHealth.score,
        utilizationPercent: contextHealth.utilizationPercent,
        shouldCompact: contextHealth.shouldCompact,
        compactThreshold: contextHealth.compactThreshold,
      },
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
