/**
 * Base Provider Adapter - Abstract class for LLM provider implementations
 *
 * Provides common functionality for instance management, cancellation,
 * and session tracking. Concrete adapters extend this class.
 */

import type {
  LLMProviderAdapter,
  ProviderCapabilities,
  QueryParams,
  NormalizedEvent,
  ModelInfo,
} from './types';

/**
 * Instance tracking for running queries
 */
export interface AdapterInstance {
  abortController: AbortController;
  sessionId?: string;
  startedAt: number;
}

/**
 * Abstract base class for provider adapters
 * Implements common instance management logic
 */
export abstract class BaseProviderAdapter implements LLMProviderAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly capabilities: ProviderCapabilities;

  /**
   * Get available models - must be implemented by concrete adapters
   */
  abstract getModels(): Promise<ModelInfo[]>;

  /** Active query instances by attemptId */
  protected instances = new Map<string, AdapterInstance>();

  /**
   * Execute query - must be implemented by concrete adapters
   */
  abstract query(params: QueryParams): AsyncIterable<NormalizedEvent>;

  /**
   * Cancel a running query
   */
  cancel(attemptId: string): boolean {
    const instance = this.instances.get(attemptId);
    if (!instance) return false;

    instance.abortController.abort();
    this.instances.delete(attemptId);
    return true;
  }

  /**
   * Get session ID for a running query
   */
  getSessionId(attemptId: string): string | undefined {
    return this.instances.get(attemptId)?.sessionId;
  }

  /**
   * Check if a query is running
   */
  isRunning(attemptId: string): boolean {
    return this.instances.has(attemptId);
  }

  /**
   * Get count of running queries
   */
  get runningCount(): number {
    return this.instances.size;
  }

  /**
   * Cancel all running queries
   */
  cancelAll(): void {
    for (const [, instance] of this.instances) {
      instance.abortController.abort();
    }
    this.instances.clear();
  }

  /**
   * Create and track a new instance
   */
  protected createInstance(attemptId: string): AdapterInstance {
    const instance: AdapterInstance = {
      abortController: new AbortController(),
      startedAt: Date.now(),
    };
    this.instances.set(attemptId, instance);
    return instance;
  }

  /**
   * Update session ID for an instance
   */
  protected setSessionId(attemptId: string, sessionId: string): void {
    const instance = this.instances.get(attemptId);
    if (instance) {
      instance.sessionId = sessionId;
    }
  }

  /**
   * Clean up an instance
   */
  protected cleanupInstance(attemptId: string): void {
    this.instances.delete(attemptId);
  }
}
