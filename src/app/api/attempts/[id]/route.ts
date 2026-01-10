import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

// GET /api/attempts/[id] - Get attempt with logs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the attempt
    const attempt = await db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.id, id))
      .limit(1);

    if (attempt.length === 0) {
      return NextResponse.json(
        { error: 'Attempt not found' },
        { status: 404 }
      );
    }

    // Fetch logs for this attempt
    const logs = await db
      .select()
      .from(schema.attemptLogs)
      .where(eq(schema.attemptLogs.attemptId, id))
      .orderBy(schema.attemptLogs.createdAt);

    return NextResponse.json({
      ...attempt[0],
      logs,
    });
  } catch (error) {
    console.error('Failed to fetch attempt:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attempt' },
      { status: 500 }
    );
  }
}
