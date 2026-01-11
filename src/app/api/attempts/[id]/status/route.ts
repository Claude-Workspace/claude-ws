import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

// GET /api/attempts/[id]/status - Get attempt status only (lightweight)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const attempt = await db
      .select({ status: schema.attempts.status })
      .from(schema.attempts)
      .where(eq(schema.attempts.id, id))
      .limit(1);

    if (attempt.length === 0) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    return NextResponse.json({ status: attempt[0].status });
  } catch (error) {
    console.error('Failed to fetch attempt status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attempt status' },
      { status: 500 }
    );
  }
}
