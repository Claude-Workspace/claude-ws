/**
 * API Route: Inline Code Edit
 *
 * POST /api/code/inline-edit
 * Initiates an inline code editing session.
 * Returns session ID for Socket.io subscription.
 */

import { NextRequest, NextResponse } from 'next/server';
import { inlineEditManager } from '@/lib/inline-edit-manager';
import path from 'path';

interface InlineEditRequestBody {
  sessionId: string;
  basePath: string;
  filePath: string;
  language: string;
  selectedCode: string;
  instruction: string;
  beforeContext?: string;
  afterContext?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: InlineEditRequestBody = await request.json();
    const { sessionId, basePath, filePath, language, selectedCode, instruction, beforeContext, afterContext } = body;

    // Validate required fields
    if (!sessionId || !basePath || !filePath || !selectedCode || !instruction) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, basePath, filePath, selectedCode, instruction' },
        { status: 400 }
      );
    }

    // Security: Reject absolute paths
    if (path.isAbsolute(filePath)) {
      return NextResponse.json({ error: 'File path must be relative' }, { status: 400 });
    }

    // Security: Validate file path is within base path
    const normalizedBase = path.resolve(basePath);
    const normalizedFile = path.resolve(normalizedBase, filePath);

    // Additional check to prevent symlink attacks
    if (!normalizedFile.startsWith(normalizedBase + path.sep) && normalizedFile !== normalizedBase) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // Validate instruction length
    if (instruction.length > 2000) {
      return NextResponse.json({ error: 'Instruction too long (max 2000 chars)' }, { status: 400 });
    }

    // Validate selected code length
    if (selectedCode.length > 50000) {
      return NextResponse.json({ error: 'Selected code too large (max 50000 chars)' }, { status: 400 });
    }

    // Validate context sizes
    const totalContext = (beforeContext?.length || 0) + (afterContext?.length || 0);
    if (totalContext > 100000) {
      return NextResponse.json({ error: 'Context too large (max 100000 chars)' }, { status: 400 });
    }

    // Start edit session (non-blocking - streaming happens via Socket.io)
    try {
      inlineEditManager.startEdit({
        sessionId,
        basePath: normalizedBase,
        filePath: normalizedFile,
        language: language || 'text',
        selectedCode,
        instruction,
        beforeContext,
        afterContext,
      });
    } catch (error) {
      console.error('[API] inline-edit start error:', error);
      return NextResponse.json({ error: 'Failed to start edit session' }, { status: 500 });
    }

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error('[API] inline-edit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/code/inline-edit?sessionId=xxx
 * Cancel an active edit session
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    const cancelled = inlineEditManager.cancelEdit(sessionId);

    return NextResponse.json({ cancelled });
  } catch (error) {
    console.error('[API] inline-edit cancel error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
