import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { uploadSessions, cleanupDirectory } from '@/lib/upload-sessions';

// POST /api/agent-factory/upload/cancel - Cancel upload session
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const session = uploadSessions.get(sessionId);

    if (session) {
      // Clean up the temporary files
      await cleanupDirectory(session.extractDir);
      uploadSessions.delete(sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error canceling upload session:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to cancel session'
    }, { status: 500 });
  }
}
