/**
 * Semaphore for controlling concurrent operations
 */
export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    if (permits <= 0) {
      throw new Error('Semaphore permits must be greater than 0');
    }
    this.permits = permits;
  }

  /**
   * Acquire a permit (blocks until available)
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // Wait for a permit to become available
    await new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  /**
   * Release a permit back to the pool
   */
  release(): void {
    if (this.queue.length > 0) {
      // Release to next waiting operation
      const resolve = this.queue.shift();
      resolve?.();
    } else {
      // Return permit to pool
      this.permits++;
    }
  }

  /**
   * Execute an operation with semaphore control
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  /**
   * Get current available permits
   */
  availablePermits(): number {
    return this.permits;
  }

  /**
   * Get number of queued operations
   */
  queuedOperations(): number {
    return this.queue.length;
  }
}
