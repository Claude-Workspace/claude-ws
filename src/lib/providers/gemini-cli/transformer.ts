/**
 * Gemini CLI Event Transformer
 *
 * Transforms Gemini NDJSON events to NormalizedEvent format.
 * Based on actual CLI output: message (user/assistant), result, init
 */

import type { NormalizedEvent } from '../types';
import type { ClaudeContentBlock } from '../../../types';

export const PROVIDER_ID = 'gemini-cli';

/**
 * Gemini NDJSON event types (based on actual CLI output)
 */
interface GeminiInitEvent {
  type: 'init';
  session_id?: string;
  timestamp?: string;
}

interface GeminiMessageEvent {
  type: 'message';
  timestamp?: string;
  role: 'user' | 'assistant';
  content: string;
  delta?: boolean;
}

interface GeminiResultEvent {
  type: 'result';
  timestamp?: string;
  status: 'success' | 'error';
  stats?: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    cached?: number;
    input?: number;
    duration_ms?: number;
  };
  error?: string;
}

interface GeminiToolUseEvent {
  type: 'tool_use';
  timestamp?: string;
  tool_name: string;
  tool_id: string;
  parameters: unknown;
}

interface GeminiToolResultEvent {
  type: 'tool_result';
  timestamp?: string;
  tool_id: string;
  status: 'success' | 'error';
  output: string;
  error?: { type: string; message?: string };
}

type GeminiEvent =
  | GeminiInitEvent
  | GeminiMessageEvent
  | GeminiResultEvent
  | GeminiToolUseEvent
  | GeminiToolResultEvent
  | { type: string };

/**
 * Parse NDJSON line into Gemini event
 */
export function parseGeminiLine(line: string): GeminiEvent | null {
  try {
    return JSON.parse(line) as GeminiEvent;
  } catch {
    console.warn('[GeminiCLI] Failed to parse NDJSON line:', line);
    return null;
  }
}

/**
 * Transform Gemini event to NormalizedEvent
 */
export function transformGeminiEvent(event: GeminiEvent): NormalizedEvent | null {
  switch (event.type) {
    case 'init': {
      const init = event as GeminiInitEvent;
      return {
        type: 'system',
        provider: PROVIDER_ID,
        subtype: 'init',
        session_id: init.session_id,
        sessionId: init.session_id,
      } as NormalizedEvent;
    }

    case 'message': {
      const msg = event as GeminiMessageEvent;
      if (msg.role === 'assistant') {
        // Assistant message - format as ClaudeOutput assistant type
        return {
          type: 'assistant',
          provider: PROVIDER_ID,
          message: {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: msg.content,
              } as ClaudeContentBlock,
            ],
          },
        } as NormalizedEvent;
      } else if (msg.role === 'user') {
        // User message - format as ClaudeOutput user type
        return {
          type: 'user',
          provider: PROVIDER_ID,
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: msg.content,
              } as ClaudeContentBlock,
            ],
          },
        } as NormalizedEvent;
      }
      return null;
    }

    case 'result': {
      const result = event as GeminiResultEvent;
      return {
        type: 'result',
        provider: PROVIDER_ID,
        subtype: result.status,
        is_error: result.status === 'error',
        // Include usage stats in providerMeta
        providerMeta: result.stats ? {
          usage: {
            totalTokens: result.stats.total_tokens,
            inputTokens: result.stats.input_tokens,
            outputTokens: result.stats.output_tokens,
            cachedTokens: result.stats.cached,
            durationMs: result.stats.duration_ms,
          },
        } : undefined,
      } as NormalizedEvent;
    }

    case 'tool_use': {
      const tool = event as GeminiToolUseEvent;
      return {
        type: 'tool_use',
        provider: PROVIDER_ID,
        id: tool.tool_id,
        tool_name: tool.tool_name,
        tool_data: tool.parameters,
      } as NormalizedEvent;
    }

    case 'tool_result': {
      const result = event as GeminiToolResultEvent;
      return {
        type: 'tool_result',
        provider: PROVIDER_ID,
        tool_data: {
          tool_use_id: result.tool_id,
          output: result.output,
          is_error: result.status === 'error',
        },
      } as NormalizedEvent;
    }

    default: {
      // Unknown event type - log and skip
      console.log('[GeminiCLI] Unknown event type:', event.type);
      return null;
    }
  }
}
