import { calculateHash, splitFileIntoChunks, getOptimalChunkSize } from './chunk-utils';

const MB = 1024 * 1024;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

export interface ChunkUploadProgress {
  uploadId: string;
  fileName: string;
  totalChunks: number;
  uploadedChunks: number;
  failedChunks: number;
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
  uploadSpeed: string;
  eta: string;
}

export interface ChunkedUploaderConfig {
  apiUrl: string;
  maxRetries?: number;
  retryDelay?: number;
  onProgress?: (progress: ChunkUploadProgress) => void;
  onChunkComplete?: (chunkIndex: number) => void;
  onChunkFailed?: (chunkIndex: number, error: Error) => void;
}

export class ChunkedUploader {
  private config: Required<Pick<ChunkedUploaderConfig, 'maxRetries' | 'retryDelay'>> & Omit<ChunkedUploaderConfig, 'maxRetries' | 'retryDelay'>;
  private abortController: AbortController | null = null;

  constructor(config: ChunkedUploaderConfig) {
    this.config = {
      ...config,
      maxRetries: config.maxRetries ?? DEFAULT_RETRIES,
      retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
    };
  }

  async upload(file: File): Promise<string> {
    if (this.abortController) {
      throw new Error('Upload already in progress');
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const fileHash = await calculateHash(file);
      const chunkSize = getOptimalChunkSize(file.size);
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadId = `${file.name}-${fileHash}-${Date.now()}`;

      const chunks = Array.from(splitFileIntoChunks(file, chunkSize));
      let uploadedChunks = 0;
      const startTime = Date.now();

      for (const { chunk, index } of chunks) {
        if (signal.aborted) throw new Error('Upload aborted');

        await this.uploadChunkWithRetry(chunk, file, uploadId, fileHash, index, totalChunks, chunkSize, signal);
        uploadedChunks++;

        this.reportProgress({
          uploadId,
          fileName: file.name,
          totalChunks,
          uploadedChunks,
          failedChunks: 0,
          progress: (uploadedChunks / totalChunks) * 100,
          bytesUploaded: Math.min(uploadedChunks * chunkSize, file.size),
          totalBytes: file.size,
          uploadSpeed: this.calculateSpeed(startTime, uploadedChunks, chunkSize),
          eta: this.calculateEta(startTime, uploadedChunks, chunkSize, file.size),
        });
      }

      return uploadId;
    } finally {
      this.abortController = null;
    }
  }

  private async uploadChunkWithRetry(
    chunk: Blob,
    file: File,
    uploadId: string,
    fileHash: string,
    chunkIndex: number,
    totalChunks: number,
    chunkSize: number,
    signal: AbortSignal
  ): Promise<void> {
    const formData = this.buildFormData(uploadId, file, fileHash, chunk, chunkIndex, totalChunks, chunkSize);

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (signal.aborted) throw new Error('Upload aborted');

      try {
        const response = await fetch(this.config.apiUrl, {
          method: 'POST',
          body: formData,
          signal,
          headers: {
            'X-Upload-Id': uploadId,
            'X-Chunk-Index': chunkIndex.toString(),
          },
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${await response.text()}`);
        }

        this.config.onChunkComplete?.(chunkIndex);
        return;
      } catch (error) {
        if (attempt === this.config.maxRetries || signal.aborted) {
          this.config.onChunkFailed?.(chunkIndex, error as Error);
          throw error;
        }

        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
      }
    }
  }

  private buildFormData(
    uploadId: string,
    file: File,
    fileHash: string,
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    chunkSize: number
  ): FormData {
    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('fileHash', fileHash);
    formData.append('chunk', chunk);
    formData.append('fileName', file.name);
    formData.append('fileSize', file.size.toString());
    formData.append('mimeType', file.type);
    return formData;
  }

  private reportProgress(progress: ChunkUploadProgress): void {
    this.config.onProgress?.(progress);
  }

  private calculateSpeed(startTime: number, uploadedChunks: number, chunkSize: number): string {
    const elapsed = (Date.now() - startTime) / 1000;
    const bytesPerSecond = (uploadedChunks * chunkSize) / elapsed;
    return `${(bytesPerSecond / MB).toFixed(2)} MB/s`;
  }

  private calculateEta(startTime: number, uploadedChunks: number, chunkSize: number, totalBytes: number): string {
    const elapsed = (Date.now() - startTime) / 1000;
    const bytesPerSecond = (uploadedChunks * chunkSize) / elapsed;
    const remainingBytes = totalBytes - (uploadedChunks * chunkSize);
    const eta = remainingBytes / bytesPerSecond;

    if (eta < 60) return `${Math.ceil(eta)}s remaining`;
    const minutes = Math.floor(eta / 60);
    const secs = Math.ceil(eta % 60);
    return `${minutes}m ${secs}s remaining`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}
