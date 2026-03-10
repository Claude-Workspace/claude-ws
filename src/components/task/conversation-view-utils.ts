import { isProviderAuthError } from '@/components/auth/agent-provider-dialog';
import type { ClaudeOutput, AttemptFile } from '@/types';

export interface ActiveQuestion {
  attemptId: string;
  toolUseId: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>;
}

export interface ConversationTurn {
  type: 'user' | 'assistant';
  prompt?: string;
  messages: ClaudeOutput[];
  attemptId: string;
  timestamp: number;
  files?: AttemptFile[];
  attemptStatus?: string;
}

export interface ToolResult {
  result: string;
  isError: boolean;
}

/**
 * Build a map of tool_use_id -> result from messages.
 * Extracts results from both top-level tool_result messages
 * and tool_result blocks nested inside user messages.
 */
export function buildToolResultsMap(messages: ClaudeOutput[]): Map<string, ToolResult> {
  const map = new Map<string, ToolResult>();

  for (const msg of messages) {
    if (msg.type === 'tool_result') {
      const toolUseId = (msg.tool_data?.tool_use_id as string) || (msg.tool_data?.id as string);
      if (toolUseId) {
        map.set(toolUseId, {
          result: extractResultString(msg.result),
          isError: msg.is_error || false,
        });
      }
    }

    // CLI outputs tool_result blocks inside user messages
    if (msg.type === 'user' && Array.isArray(msg.message?.content)) {
      for (const block of msg.message.content) {
        if (block.type === 'tool_result') {
          const toolUseId = (block as { tool_use_id?: string }).tool_use_id;
          if (toolUseId) {
            const content = (block as { content?: string }).content;
            map.set(toolUseId, {
              result: typeof content === 'string' ? content : JSON.stringify(content || ''),
              isError: (block as { is_error?: boolean }).is_error || false,
            });
          }
        }
      }
    }
  }

  return map;
}

function extractResultString(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const obj = result as { text?: string };
    return obj.text || JSON.stringify(result);
  }
  return '';
}

/**
 * Check if messages contain visible content (text, thinking, or tool_use).
 * Used to keep the "Thinking..." spinner until actual content appears.
 */
export function hasVisibleContent(messages: ClaudeOutput[]): boolean {
  return messages.some(msg => {
    if (msg.type === 'assistant' && msg.message?.content?.length) {
      return msg.message.content.some(block =>
        (block.type === 'text' && block.text) ||
        (block.type === 'thinking' && block.thinking) ||
        block.type === 'tool_use'
      );
    }
    return msg.type === 'tool_use';
  });
}

/**
 * Check if messages contain an auth/provider error and return the error message.
 */
export function findAuthError(messages: ClaudeOutput[]): string | null {
  for (const msg of messages) {
    if (msg.type === 'tool_result' && msg.is_error && msg.result) {
      const result = typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result);
      if (isProviderAuthError(result)) return result;
    }

    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text && isProviderAuthError(block.text)) {
          return block.text;
        }
      }
    }
  }
  return null;
}

/**
 * Find the last tool_use ID across all messages.
 */
export function findLastToolUseId(messages: ClaudeOutput[]): string | null {
  let lastToolUseId: string | null = null;
  for (const msg of messages) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'tool_use' && block.id) {
          lastToolUseId = block.id;
        }
      }
    }
    if (msg.type === 'tool_use' && msg.id) {
      lastToolUseId = msg.id;
    }
  }
  return lastToolUseId;
}

/**
 * Check if a tool_use is currently executing (last tool with no result yet).
 */
export function isToolExecuting(
  toolId: string,
  lastToolUseId: string | null,
  toolResultsMap: Map<string, ToolResult>,
  isStreaming: boolean
): boolean {
  if (!isStreaming) return false;
  if (toolResultsMap.has(toolId)) return false;
  return toolId === lastToolUseId;
}

/** Check if a MIME type represents an image. */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Format a timestamp for display (time-only for today, date+time otherwise). */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
