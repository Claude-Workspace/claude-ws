import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

// POST /api/attempts/[id]/answer - Save a user's answer to database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { questions, answers, toolUseId } = body as { questions: unknown[]; answers: Record<string, string>; toolUseId?: string };

    // Save the answer as an attempt log (with bold formatting for display)
    const answerText = Object.entries(answers)
      .map(([question, answer]) => `${question}: **${answer}**`)
      .join('\n');

    await db.insert(schema.attemptLogs).values({
      attemptId: id,
      type: 'json',
      content: JSON.stringify({
        type: 'user_answer',
        toolUseId, // Save toolUseId to map answer to specific question
        questions,
        answers,
        displayText: `✓ You answered:\n${answerText}`
      }),
      createdAt: Date.now(),
    });

    console.log(`[answer] Saved answer for attempt ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving answer:', error);
    return NextResponse.json(
      { error: 'Failed to save answer' },
      { status: 500 }
    );
  }
}
