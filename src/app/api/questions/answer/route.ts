import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/lib/agent-manager';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

// POST /api/questions/answer - Answer a pending question via REST API
// Used by the global questions panel (which doesn't have a socket connection to the attempt room)
export async function POST(request: NextRequest) {
  try {
    const { attemptId, toolUseId, questions, answers } = await request.json() as {
      attemptId: string;
      toolUseId: string;
      questions: unknown[];
      answers: Record<string, string>;
    };

    if (!agentManager.hasPendingQuestion(attemptId)) {
      return NextResponse.json(
        { error: 'No pending question for this attempt' },
        { status: 404 }
      );
    }

    const success = agentManager.answerQuestion(attemptId, toolUseId, questions, answers);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to answer question' },
        { status: 400 }
      );
    }

    // Save answer to database for persistence
    const answerText = Object.entries(answers)
      .map(([question, answer]) => `${question}: **${answer}**`)
      .join('\n');

    await db.insert(schema.attemptLogs).values({
      attemptId,
      type: 'json',
      content: JSON.stringify({
        type: 'user_answer',
        questions,
        answers,
        displayText: `✓ You answered:\n${answerText}`
      }),
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error answering question:', error);
    return NextResponse.json(
      { error: 'Failed to answer question' },
      { status: 500 }
    );
  }
}
