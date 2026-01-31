/**
 * Claude SDK Message Transformer
 *
 * Converts SDK messages to NormalizedEvent using existing sdk-event-adapter.
 */

import { adaptSDKMessage, isValidSDKMessage, type SDKMessage } from '@/lib/sdk-event-adapter';
import { normalizeEvent } from '../event-normalizer';
import type { NormalizedEvent } from '../types';

export const PROVIDER_ID = 'claude-sdk';

/**
 * Transform SDK message to NormalizedEvent
 *
 * Uses existing adaptSDKMessage from sdk-event-adapter.ts for backward compatibility.
 */
export function transformSDKMessage(message: SDKMessage): {
  event: NormalizedEvent;
  sessionId?: string;
  checkpointUuid?: string;
  backgroundShell?: unknown;
} {
  // Validate message structure
  if (!isValidSDKMessage(message)) {
    throw new Error('Invalid SDK message structure');
  }

  // Adapt SDK message to ClaudeOutput
  const adapted = adaptSDKMessage(message);

  // Normalize to NormalizedEvent with provider metadata
  const event = normalizeEvent(adapted.output, PROVIDER_ID, {
    sessionId: adapted.sessionId,
    checkpointUuid: adapted.checkpointUuid,
  });

  return {
    event,
    sessionId: adapted.sessionId,
    checkpointUuid: adapted.checkpointUuid,
    backgroundShell: adapted.backgroundShell,
  };
}
