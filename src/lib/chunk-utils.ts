import { createHash } from 'crypto';

const MB = 1024 * 1024;
const SIZES = {
  SMALL: 5 * MB,
  MEDIUM: 50 * MB,
  LARGE: 100 * MB,
};
const CHUNK_SIZES = {
  SMALL: 1 * MB,
  DEFAULT: 5 * MB,
  LARGE: 10 * MB,
};

export async function calculateHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = createHash('sha256');
  hash.update(new Uint8Array(buffer));
  return hash.digest('hex');
}

export function* splitFileIntoChunks(
  file: File,
  chunkSize: number
): Generator<{ chunk: Blob; index: number }> {
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    yield { chunk: file.slice(start, end), index: i };
  }
}

export function getOptimalChunkSize(fileSize: number): number {
  if (fileSize < SIZES.SMALL) return CHUNK_SIZES.SMALL;
  if (fileSize < SIZES.MEDIUM) return CHUNK_SIZES.DEFAULT;
  return CHUNK_SIZES.LARGE;
}

export function getOptimalConcurrency(fileSize: number): number {
  if (fileSize < SIZES.SMALL) return 2;
  if (fileSize < SIZES.MEDIUM) return 3;
  if (fileSize < SIZES.LARGE) return 4;
  return 6;
}

export function calculateExpectedUploadTime(
  fileSize: number,
  uploadSpeedMbps: number = 10
): number {
  const bytesPerSecond = (uploadSpeedMbps * MB) / 8;
  return fileSize / bytesPerSecond;
}
