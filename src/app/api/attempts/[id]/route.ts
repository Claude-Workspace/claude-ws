import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { formatOutput } from '@/lib/output-formatter';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
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
      const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
      const filePath = join(dataDir, 'tmp', `${id}.${storedFormat}`);

      if (existsSync(filePath)) {
        try {
          const content = await readFile(filePath, 'utf-8');

          // Map common extensions to MIME types
          const contentTypes: Record<string, string> = {
            // Data formats
            json: 'application/json',
            xml: 'application/xml',
            yaml: 'text/yaml',
            yml: 'text/yaml',
            csv: 'text/csv',
            tsv: 'text/tab-separated-values',
            txt: 'text/plain',

            // Web formats
            html: 'text/html',
            css: 'text/css',
            js: 'application/javascript',
            ts: 'application/typescript',
            md: 'text/markdown',

            // Office documents
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            xls: 'application/vnd.ms-excel',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            doc: 'application/msword',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ppt: 'application/vnd.ms-powerpoint',

            // Archives
            zip: 'application/zip',
            rar: 'application/vnd.rar',
            '7z': 'application/x-7z-compressed',
            tar: 'application/x-tar',
            gz: 'application/gzip',

            // Executables
            exe: 'application/vnd.microsoft.portable-executable',
            dll: 'application/vnd.microsoft.portable-executable',
            app: 'application/octet-stream',

            // Images
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            webp: 'image/webp',
            ico: 'image/x-icon',

            // Video
            mp4: 'video/mp4',
            webm: 'video/webm',
            avi: 'video/x-msvideo',
            mov: 'video/quicktime',

            // Audio
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            ogg: 'audio/ogg',

            // PDF
            pdf: 'application/pdf',
          };

          const contentType = contentTypes[storedFormat.toLowerCase()] || 'application/octet-stream';

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
