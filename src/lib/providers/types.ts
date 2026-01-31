/**
 * Provider Types - Core interfaces for multi-CLI backend architecture
 *
 * Defines Strategy pattern contracts for LLM provider adapters.
 * Extends existing ClaudeOutput for backward compatibility.
 */

import type { ClaudeOutput } from '@/types';

/**
 * Provider capability flags for feature detection
 */
export interface ProviderCapabilities {
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports session resume/continuation */
  sessionResume: boolean;
  /** Supports function/tool calling */
  toolCalling: boolean;
  /** Supports Model Context Protocol servers */
  mcpSupport: boolean;
  /** Supports thinking/reasoning blocks */
  thinkingBlocks: boolean;
  /** Maximum context window in tokens */
  maxContextTokens: number;
}

/**
 * Unified query parameters for all providers
 */
export interface QueryParams {
  attemptId: string;
  taskId?: string; // Task ID for session management
  projectPath: string;
  prompt: string;
  sessionOptions?: {
    resume?: string;
    resumeSessionAt?: string;
  };
  filePaths?: string[];
  outputFormat?: string;
  outputSchema?: string;
  maxTurns?: number;
  modelId?: string; // Model override (uses provider default if not specified)
  abortSignal?: AbortSignal;
}

/**
 * Normalized event extending ClaudeOutput with provider metadata
 * Backward compatible - works wherever ClaudeOutput is expected
 */
export interface NormalizedEvent extends ClaudeOutput {
  /** Provider identifier (e.g., 'claude-sdk', 'gemini-cli') */
  provider: string;
  /** Session ID from provider (for resume) */
  sessionId?: string;
  /** Checkpoint UUID for conversation rewind */
  checkpointUuid?: string;
  /** Provider-specific metadata */
  providerMeta?: Record<string, unknown>;
}

/**
 * Core adapter interface - Strategy pattern contract
 */
export interface LLMProviderAdapter {
  /** Unique provider identifier */
  readonly id: string;
  /** Human-readable provider name */
  readonly name: string;
  /** Provider capability flags */
  readonly capabilities: ProviderCapabilities;

  /**
   * Get available models for this provider
   * Returns cached or dynamically fetched models
   */
  getModels(): Promise<ModelInfo[]>;

  /**
   * Execute a query and stream normalized events
   */
  query(params: QueryParams): AsyncIterable<NormalizedEvent>;

  /**
   * Cancel a running query
   * @returns true if query was found and cancelled
   */
  cancel(attemptId: string): boolean;

  /**
   * Get session ID for a running query
   */
  getSessionId(attemptId: string): string | undefined;

  /**
   * Check if a query is running
   */
  isRunning(attemptId: string): boolean;

  /**
   * Answer a pending AskUserQuestion (optional)
   */
  answerQuestion?(attemptId: string, questions: unknown[], answers: Record<string, string>): boolean;

  /**
   * Cancel a pending question (optional)
   */
  cancelQuestion?(attemptId: string): boolean;

  /**
   * Check if there's a pending question (optional)
   */
  hasPendingQuestion?(attemptId: string): boolean;

  /**
   * Get count of running queries
   */
  readonly runningCount: number;

  /**
   * Cancel all running queries
   */
  cancelAll(): void;
}

/**
 * Provider configuration options
 */
export interface ProviderConfig {
  /** Model identifier */
  model?: string;
  /** API key (if required) */
  apiKey?: string;
  /** MCP server configurations */
  mcpServers?: Record<string, unknown>;
  /** Provider-specific options */
  [key: string]: unknown;
}

/**
 * Factory interface for creating provider adapters
 */
export interface ProviderFactory {
  /**
   * Create a new adapter instance
   */
  create(config: ProviderConfig): LLMProviderAdapter;

  /**
   * Validate configuration
   */
  validate(config: ProviderConfig): boolean;
}

/**
 * Model information for provider
 */
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

/**
 * Provider availability info for UI
 */
export interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  reason?: string;
  capabilities: ProviderCapabilities;
  models: ModelInfo[];
  /** True if models are from cache (fetch failed) */
  modelsFromCache?: boolean;
}
