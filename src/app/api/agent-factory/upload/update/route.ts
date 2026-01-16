import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { uploadSessions, type ExtractedItem } from '@/lib/upload-sessions';

// POST /api/agent-factory/upload/update - Update session with selections
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { sessionId, items } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
    }

    const session = uploadSessions.get(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session expired or not found' }, { status: 400 });
    }

    // Update the session items with the new selections
    session.items = items as ExtractedItem[];
    uploadSessions.set(sessionId, session);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update session'
    }, { status: 500 });
  }
}
