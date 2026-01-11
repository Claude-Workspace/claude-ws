import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// POST /api/checkpoints/backfill
// Creates checkpoints for existing completed attempts that don't have one
export async function POST() {
  try {
    // Get all completed attempts with session_id that don't have checkpoints
    const completedAttempts = await db.query.attempts.findMany({
      where: and(
        eq(schema.attempts.status, 'completed'),
      ),
    });

    let created = 0;
    let skipped = 0;

    for (const attempt of completedAttempts) {
      if (!attempt.sessionId) {
        skipped++;
        continue;
      }

      // Check if checkpoint already exists for this attempt
      const existing = await db.query.checkpoints.findFirst({
        where: eq(schema.checkpoints.attemptId, attempt.id),
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Get logs for this attempt
      const logs = await db.query.attemptLogs.findMany({
        where: eq(schema.attemptLogs.attemptId, attempt.id),
      });

      // Extract summary from last assistant message
      let summary = '';
      for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].type === 'json') {
          try {
            const data = JSON.parse(logs[i].content);
            if (data.type === 'assistant' && data.message?.content) {
              const text = data.message.content
                .filter((b: { type: string }) => b.type === 'text')
                .map((b: { text: string }) => b.text)
                .join(' ');
              summary = text.substring(0, 100) + (text.length > 100 ? '...' : '');
              break;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Create checkpoint
      await db.insert(schema.checkpoints).values({
        id: nanoid(),
        taskId: attempt.taskId,
        attemptId: attempt.id,
        sessionId: attempt.sessionId,
        messageCount: logs.filter((l) => l.type === 'json').length,
        summary,
        createdAt: attempt.completedAt || attempt.createdAt,
      });

      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: completedAttempts.length,
    });
  } catch (error) {
    console.error('Failed to backfill checkpoints:', error);
    return NextResponse.json(
      { error: 'Failed to backfill checkpoints' },
      { status: 500 }
    );
  }
}
