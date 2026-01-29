import { Semaphore } from './semaphore';
import { ChunkUploadProgress } from './chunked-uploader';
import { getOptimalChunkSize, splitFileIntoChunks } from './chunk-utils';

const DEFAULT_CONCURRENCY = 3;

export interface UploadTask {
  file: File;
  uploadId: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: ChunkUploadProgress;
}

export interface ConcurrentUploadOptions {
  apiUrl: string;
  maxConcurrency?: number;
  onProgress?: (progress: ChunkUploadProgress) => void;
  onChunkComplete?: (chunkIndex: number) => void;
  onChunkFailed?: (chunkIndex: number, error: Error) => void;
}

export class ConcurrentUploadManager {
  private semaphore: Semaphore;
  private tasks: Map<string, UploadTask> = new Map();
  private abortController: AbortController | null = null;
  private apiUrl: string;
  private callbacks: Pick<ConcurrentUploadOptions, 'onProgress' | 'onChunkComplete' | 'onChunkFailed'>;

  constructor(options: ConcurrentUploadOptions) {
    this.semaphore = new Semaphore(options.maxConcurrency ?? DEFAULT_CONCURRENCY);
    this.apiUrl = options.apiUrl;
    this.callbacks = {
      onProgress: options.onProgress,
      onChunkComplete: options.onChunkComplete,
      onChunkFailed: options.onChunkFailed,
    };
  }

  async uploadFile(file: File): Promise<string> {
    if (this.abortController) {
      throw new Error('Upload already in progress');
    }

    this.abortController = new AbortController();

    try {
      const chunkSize = getOptimalChunkSize(file.size);
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadId = `${file.name}-${Date.now()}`;

      const task: UploadTask = {
        file,
        uploadId,
        status: 'uploading',
        progress: this.createInitialProgress(file, totalChunks),
      };

      this.tasks.set(file.name, task);

      const chunks = Array.from(splitFileIntoChunks(file, chunkSize));
      await Promise.all(
        chunks.map(({ chunk, index }) =>
          this.semaphore.execute(() => this.uploadChunk(chunk, file, index, totalChunks, chunkSize, uploadId))
        )
      );

      task.status = 'completed';
      return uploadId;
    } finally {
      this.abortController = null;
    }
  }

  private createInitialProgress(file: File, totalChunks: number): ChunkUploadProgress {
    return {
      uploadId: '',
      fileName: file.name,
      totalChunks,
      uploadedChunks: 0,
      failedChunks: 0,
      progress: 0,
      bytesUploaded: 0,
      totalBytes: file.size,
      uploadSpeed: '0 MB/s',
      eta: 'Calculating...',
    };
  }

  private async uploadChunk(
    chunk: Blob,
    file: File,
    chunkIndex: number,
    totalChunks: number,
    chunkSize: number,
    uploadId: string
  ): Promise<void> {
    if (this.abortController?.signal.aborted) {
      throw new Error('Upload aborted');
    }

    const formData = this.buildChunkFormData(uploadId, file, chunk, chunkIndex, totalChunks);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        body: formData,
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`Chunk ${chunkIndex} upload failed`);
      }

      this.updateTaskProgress(file.name, chunkIndex, totalChunks, chunkSize);
      this.callbacks.onChunkComplete?.(chunkIndex);
    } catch (error) {
      this.callbacks.onChunkFailed?.(chunkIndex, error as Error);
      throw error;
    }
  }

  private buildChunkFormData(
    uploadId: string,
    file: File,
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number
  ): FormData {
    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('chunk', chunk);
    formData.append('fileName', file.name);
    formData.append('fileSize', file.size.toString());
    formData.append('mimeType', file.type);
    return formData;
  }

  private updateTaskProgress(fileName: string, chunkIndex: number, totalChunks: number, chunkSize: number): void {
    const task = this.tasks.get(fileName);
    if (!task) return;

    task.progress.uploadedChunks++;
    task.progress.progress = (task.progress.uploadedChunks / totalChunks) * 100;
    task.progress.bytesUploaded = Math.min(task.progress.uploadedChunks * chunkSize, task.progress.totalBytes);

    this.callbacks.onProgress?.(task.progress);
  }

  abortAll(): void {
    this.abortController?.abort();
    this.abortController = null;

    for (const task of this.tasks.values()) {
      if (task.status === 'uploading') {
        task.status = 'failed';
      }
    }
  }

  getTask(filename: string): UploadTask | undefined {
    return this.tasks.get(filename);
  }

  getAllTasks(): UploadTask[] {
    return Array.from(this.tasks.values());
  }

  clearCompleted(): void {
    for (const [filename, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'failed') {
        this.tasks.delete(filename);
      }
    }
  }
}
