/**
 * Event Normalizer - Utilities for transforming provider events
 *
 * Converts provider-specific events to NormalizedEvent format
 * for unified handling in AgentManager.
 */

import type { ClaudeOutput } from '@/types';
import type { NormalizedEvent } from './types';

/**
 * Metadata for event normalization
 */
export interface NormalizationMeta {
  sessionId?: string;
  checkpointUuid?: string;
  providerMeta?: Record<string, unknown>;
}

/**
 * Convert ClaudeOutput to NormalizedEvent
 */
export function normalizeEvent(
  output: ClaudeOutput,
  provider: string,
  meta?: NormalizationMeta
): NormalizedEvent {
  return {
    ...output,
    provider,
    sessionId: meta?.sessionId,
    checkpointUuid: meta?.checkpointUuid,
    providerMeta: meta?.providerMeta,
  };
}

/**
 * Type guard for NormalizedEvent
 */
export function isNormalizedEvent(event: unknown): event is NormalizedEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    'provider' in event &&
    typeof (event as NormalizedEvent).provider === 'string'
  );
}

/**
 * Extract ClaudeOutput from NormalizedEvent (for backward compat)
 */
export function toClaudeOutput(event: NormalizedEvent): ClaudeOutput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { provider, sessionId, checkpointUuid, providerMeta, ...output } = event;
  return output;
}

/**
 * Create a system event
 */
export function createSystemEvent(
  provider: string,
  subtype: string,
  content?: string
): NormalizedEvent {
  return {
    type: 'system',
    provider,
    subtype,
    message: content ? { content: [{ type: 'text', text: content }] } : undefined,
  };
}

/**
 * Create an error event
 */
export function createErrorEvent(
  provider: string,
  error: Error | string
): NormalizedEvent {
  const message = error instanceof Error ? error.message : error;
  return {
    type: 'result',
    provider,
    is_error: true,
    result: message,
  };
}
