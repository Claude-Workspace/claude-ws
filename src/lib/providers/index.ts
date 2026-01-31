/**
 * Provider Adapters - Main exports
 *
 * Central export point for all LLM provider adapters
 */

// Types
export type {
  LLMProviderAdapter,
  ProviderCapabilities,
  QueryParams,
  NormalizedEvent,
  ProviderConfig,
  ProviderFactory,
  ProviderInfo,
} from './types';

// Base adapter
export { BaseProviderAdapter } from './base-adapter';

// Event normalizer utilities
export {
  normalizeEvent,
  isNormalizedEvent,
  toClaudeOutput,
  createSystemEvent,
  createErrorEvent,
} from './event-normalizer';

// Claude SDK adapter
export { ClaudeSDKAdapter, PROVIDER_ID as CLAUDE_SDK_ID } from './claude-sdk';

// Gemini CLI adapter
export { GeminiCLIAdapter, PROVIDER_ID as GEMINI_CLI_ID, isGeminiInstalled } from './gemini-cli';

// Provider Registry
export {
  getProviderRegistry,
  initializeProviders,
  resolveProviderId,
  DEFAULT_PROVIDER_ID,
} from './registry';
