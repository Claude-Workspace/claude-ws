import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { formatOutput } from '@/lib/output-formatter';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getContentTypeForFormat } from '@/lib/content-types';
import type { ClaudeOutput, OutputFormat } from '@/types';

// GET /api/attempts/[id] - Get attempt with logs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

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

    const attemptData = attempt[0];

    // Check if ?output_format query param is present
    const wantsFormatted = searchParams.has('output_format');
    const storedFormat = attemptData.outputFormat;

    // If ?output_format is present and attempt has a format, return the generated file
    if (wantsFormatted && storedFormat) {
      // Use DATA_DIR for output file location
      const dataDir = process.env.DATA_DIR || join(process.env.CLAUDE_WS_USER_CWD || process.cwd(), 'data');
      const filePath = join(dataDir, 'tmp', `${id}.${storedFormat}`);

      if (existsSync(filePath)) {
        try {
          const content = await readFile(filePath, 'utf-8');
          const contentType = getContentTypeForFormat(storedFormat);

          return new NextResponse(content, {
            headers: {
              'Content-Type': contentType,
            },
          });
        } catch (readError) {
          return NextResponse.json(
            { error: 'Failed to read output file' },
            { status: 500 }
          );
        }
      }

      // File doesn't exist yet
      return NextResponse.json(
        { error: 'Output file not found', filePath },
        { status: 404 }
      );
    }

    // Fetch logs for this attempt
    const logs = await db
      .select()
      .from(schema.attemptLogs)
      .where(eq(schema.attemptLogs.attemptId, id))
      .orderBy(schema.attemptLogs.createdAt);

    // Default: return original JSON structure with logs
    if (!storedFormat || storedFormat === 'json') {
      return NextResponse.json({
        ...attemptData,
        logs,
      });
    }

    // Format according to the stored outputFormat
    const messages: ClaudeOutput[] = logs
      .filter(log => log.type === 'json')
      .map(log => {
        try {
          return JSON.parse(log.content) as ClaudeOutput;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ClaudeOutput[];

    const formatted = formatOutput(
      messages,
      storedFormat as OutputFormat,
      attemptData.outputSchema,
      {
        id: attemptData.id,
        taskId: attemptData.taskId,
        prompt: attemptData.prompt,
        status: attemptData.status,
        createdAt: attemptData.createdAt,
        completedAt: attemptData.completedAt
      }
    );

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch attempt' },
      { status: 500 }
    );
  }
}

// POST /api/attempts/[id] - Reactivate a completed/failed attempt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the attempt
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

    const attemptData = attempt[0];

    // Only reactivate attempts that are not already running
    if (attemptData.status === 'running') {
      return NextResponse.json({
        success: true,
        alreadyRunning: true,
        attempt: { id: attemptData.id, status: attemptData.status }
      });
    }

    // Reactivate the attempt
    await db
      .update(schema.attempts)
      .set({
        status: 'running',
        completedAt: null,  // Clear completion time
      })
      .where(eq(schema.attempts.id, id));

    console.log(`[reactivate] Reactivated attempt ${id} for task ${attemptData.taskId}`);

    return NextResponse.json({
      success: true,
      attempt: { id: attemptData.id, status: 'running' }
    });
  } catch (error) {
    console.error('Error reactivating attempt:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate attempt' },
      { status: 500 }
    );
  }
}
