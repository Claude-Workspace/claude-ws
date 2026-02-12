import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/lib/agent-manager';

// GET /api/attempts/[id]/pending-question - Get current pending question for an attempt
// Used by reconnecting clients to recover question state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const data = agentManager.getPendingQuestionData(id);
    if (!data) {
      return NextResponse.json({ question: null });
    }

    return NextResponse.json({
      question: {
        attemptId: id,
        toolUseId: data.toolUseId,
        questions: data.questions,
      },
    });
  } catch (error) {
    console.error('Error getting pending question:', error);
    return NextResponse.json(
      { error: 'Failed to get pending question' },
      { status: 500 }
    );
  }
}
