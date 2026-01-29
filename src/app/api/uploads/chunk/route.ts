import { NextRequest, NextResponse } from 'next/server';
import Busboy from 'busboy';
import { Readable } from 'stream';
import {
  initializeChunkSession,
  storeChunk,
  isUploadComplete,
  reassembleFile,
  getSession,
} from '@/lib/chunk-sessions';

const MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const HIGH_WATER_MARK = 64 * 1024; // 64KB

interface ParsedFormData {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  fileHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkData: Buffer;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await parseMultipartRequest(request);

    // Validate required fields
    if (!formData.uploadId || !formData.chunkData || formData.chunkData.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate field values
    if (isNaN(formData.chunkIndex) || formData.chunkIndex < 0) {
      return NextResponse.json({ error: 'Invalid chunk index' }, { status: 400 });
    }

    if (isNaN(formData.totalChunks) || formData.totalChunks < 1 || formData.totalChunks > 1000) {
      return NextResponse.json({ error: 'Invalid total chunks' }, { status: 400 });
    }

    if (!formData.fileName || formData.fileName.length > 255) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    if (isNaN(formData.fileSize) || formData.fileSize <= 0 || formData.fileSize > 500 * 1024 * 1024) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 });
    }

    // Validate file hash format (64 hex characters for SHA-256)
    if (!/^[a-f0-9]{64}$/i.test(formData.fileHash)) {
      return NextResponse.json({ error: 'Invalid file hash format' }, { status: 400 });
    }

    // Validate chunk index is within bounds
    if (formData.chunkIndex >= formData.totalChunks) {
      return NextResponse.json({ error: 'Chunk index out of bounds' }, { status: 400 });
    }

    const existingSession = getSession(formData.uploadId);
    if (!existingSession) {
      await initializeChunkSession(
        formData.uploadId,
        formData.fileName,
        formData.fileSize,
        formData.mimeType,
        formData.totalChunks,
        formData.fileHash
      );
    }

    await storeChunk(formData.uploadId, formData.chunkIndex, formData.chunkData);

    const session = getSession(formData.uploadId)!;
    const complete = isUploadComplete(formData.uploadId);

    let filePath: string | undefined;
    if (complete) {
      const reassembled = await reassembleFile(formData.uploadId);
      filePath = reassembled.filePath;
    }

    return NextResponse.json({
      success: true,
      chunkIndex: formData.chunkIndex,
      received: session.receivedChunks.size,
      total: formData.totalChunks,
      complete,
      filePath,
    });
  } catch (error) {
    console.error('Chunk upload error:', error);
    return NextResponse.json({ error: 'Failed to upload chunk' }, { status: 500 });
  }
}

async function parseMultipartRequest(request: NextRequest): Promise<ParsedFormData> {
  const formData: Record<string, string> = {};
  let chunkData: Buffer = Buffer.alloc(0);

  const nodeRequest = await convertToNodeRequest(request);

  await new Promise<void>((resolve, reject) => {
    const busboy = Busboy({
      headers: { 'content-type': request.headers.get('content-type') || '' },
      limits: {
        fileSize: MAX_CHUNK_SIZE,
        files: 1,
      },
      highWaterMark: HIGH_WATER_MARK,
    });

    busboy.on('field', (fieldname: string, value: string) => {
      formData[fieldname] = value;
    });

    busboy.on('file', (fieldname: string, file: any) => {
      if (fieldname !== 'chunk') {
        file.resume();
        return;
      }

      const chunks: Buffer[] = [];
      file.on('data', (chunk: Buffer) => chunks.push(chunk));
      file.on('end', () => {
        chunkData = Buffer.concat(chunks);
      });
      file.on('error', reject);
    });

    busboy.on('finish', resolve);
    busboy.on('error', reject);

    nodeRequest.pipe(busboy);
  });

  return {
    uploadId: formData.uploadId || '',
    chunkIndex: parseInt(formData.chunkIndex || '0', 10),
    totalChunks: parseInt(formData.totalChunks || '1', 10),
    fileHash: formData.fileHash || '',
    fileName: formData.fileName || '',
    fileSize: parseInt(formData.fileSize || '0', 10),
    mimeType: formData.mimeType || 'application/octet-stream',
    chunkData,
  };
}

async function convertToNodeRequest(request: NextRequest): Promise<Readable> {
  const buffer = Buffer.from(await request.arrayBuffer());

  return new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    },
  });
}
