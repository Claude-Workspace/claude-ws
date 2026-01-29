import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { readFile as readFileBuffer } from 'fs/promises';
import { TEMP_DIR, sanitizeFilename } from './file-utils';

const MAX_SESSIONS = 1000;

const CHUNKS_DIR = join(TEMP_DIR, 'chunks');
const REASSEMBLED_DIR = join(TEMP_DIR, 'reassembled');
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

export interface ChunkInfo {
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  chunkPaths: Map<number, string>;
  fileHash: string;
  createdAt: number;
}

export interface ReassembledFileInfo {
  uploadId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileHash: string;
  reassembledAt: number;
}

const chunkSessions = new Map<string, ChunkInfo>();

export async function initializeChunkSession(
  uploadId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  totalChunks: number,
  fileHash: string
): Promise<void> {
  if (chunkSessions.size >= MAX_SESSIONS) {
    throw new Error('Maximum upload sessions reached');
  }

  await mkdir(CHUNKS_DIR, { recursive: true });
  await mkdir(REASSEMBLED_DIR, { recursive: true });

  const sanitizedFileName = sanitizeFilename(fileName);

  chunkSessions.set(uploadId, {
    uploadId,
    fileName: sanitizedFileName,
    fileSize,
    mimeType,
    totalChunks,
    receivedChunks: new Set(),
    chunkPaths: new Map(),
    fileHash,
    createdAt: Date.now(),
  });
}

export async function storeChunk(
  uploadId: string,
  chunkIndex: number,
  chunkData: Buffer
): Promise<string> {
  const session = chunkSessions.get(uploadId);
  if (!session) {
    throw new Error(`Upload session not found: ${uploadId}`);
  }

  const sessionDir = join(CHUNKS_DIR, uploadId);
  await mkdir(sessionDir, { recursive: true });

  const chunkPath = join(sessionDir, `chunk-${chunkIndex}`);
  await writeFile(chunkPath, chunkData);

  session.receivedChunks.add(chunkIndex);
  session.chunkPaths.set(chunkIndex, chunkPath);

  return chunkPath;
}

export function isUploadComplete(uploadId: string): boolean {
  const session = chunkSessions.get(uploadId);
  return session ? session.receivedChunks.size === session.totalChunks : false;
}

export async function reassembleFile(uploadId: string): Promise<ReassembledFileInfo> {
  const session = chunkSessions.get(uploadId);
  if (!session) {
    throw new Error(`Upload session not found: ${uploadId}`);
  }

  if (!isUploadComplete(uploadId)) {
    throw new Error(
      `Upload incomplete: ${session.receivedChunks.size}/${session.totalChunks} chunks received`
    );
  }

  const outputPath = join(REASSEMBLED_DIR, `${uploadId}-${sanitizeFilename(session.fileName)}`);
  const writeStream = createWriteStream(outputPath);
  const hash = createHash('sha256');

  for (let i = 0; i < session.totalChunks; i++) {
    const chunkPath = session.chunkPaths.get(i);
    if (!chunkPath) {
      throw new Error(`Missing chunk ${i}`);
    }

    const readStream = createReadStream(chunkPath);
    await pipeline(readStream, writeStream, { end: false });
    hash.update(await readFileBuffer(chunkPath));
  }

  writeStream.end();

  const calculatedHash = hash.digest('hex');
  if (calculatedHash !== session.fileHash) {
    await unlink(outputPath);
    throw new Error('File integrity check failed: hash mismatch');
  }

  await cleanupChunks(uploadId);

  return {
    uploadId,
    fileName: session.fileName,
    filePath: outputPath,
    fileSize: session.fileSize,
    fileHash: calculatedHash,
    reassembledAt: Date.now(),
  };
}

export async function cleanupChunks(uploadId: string): Promise<void> {
  const session = chunkSessions.get(uploadId);
  if (!session) return;

  for (const chunkPath of session.chunkPaths.values()) {
    try {
      await unlink(chunkPath);
    } catch {
      // Ignore errors
    }
  }

  chunkSessions.delete(uploadId);
}

export function getSession(uploadId: string): ChunkInfo | undefined {
  return chunkSessions.get(uploadId);
}

export function getAllSessions(): ChunkInfo[] {
  return Array.from(chunkSessions.values());
}

setInterval(() => {
  const now = Date.now();
  for (const [uploadId, session] of chunkSessions.entries()) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      cleanupChunks(uploadId).catch(console.error);
    }
  }
}, CLEANUP_INTERVAL);
