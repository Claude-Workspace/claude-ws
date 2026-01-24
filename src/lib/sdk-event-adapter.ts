/**
 * SDK Event Adapter - Normalizes Claude Agent SDK messages to internal ClaudeOutput format
 *
 * Handles conversion from SDK stream message types to existing frontend types,
 * ensuring backward compatibility with current UI components.
 */

import type { ClaudeOutput, ClaudeContentBlock, ClaudeOutputType } from '@/types';

// SDK message types (from @anthropic-ai/claude-agent-sdk)
// These are the actual types emitted by the SDK query() iterator
export interface MCPServerStatus {
  name: string;
  status: 'connected' | 'failed' | 'connecting';
  error?: string;
  tools?: string[];
}

export interface SDKSystemMessage {
  type: 'system';
  subtype: 'init' | string;
  session_id?: string;
  tools?: unknown[];
  mcp_servers?: MCPServerStatus[];
}

export interface SDKAssistantMessage {
  type: 'assistant';
  message: {
    id?: string;
    role: 'assistant';
    content: SDKContentBlock[];
    model?: string;
    stop_reason?: string;
    stop_sequence?: string | null;
    usage?: { input_tokens: number; output_tokens: number };
  };
}

export interface SDKUserMessage {
  type: 'user';
  message: {
    role: 'user';
    content: SDKContentBlock[];
  };
  uuid?: string; // Checkpoint UUID (when replay-user-messages enabled)
}

export interface SDKResultMessage {
  type: 'result';
  subtype: string;
  session_id?: string;
  cost_usd?: number;
  is_error?: boolean;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
}

// Streaming event types from Anthropic API (wrapped by SDK)
export interface SDKStreamEvent {
  type: 'stream_event';
  event: {
    type: string;
    index?: number;
    delta?: {
      type: 'text_delta' | 'thinking_delta' | 'input_json_delta';
      text?: string;
      thinking?: string;
      partial_json?: string; // for tools - we ignore this
    };
    content_block?: {
      type: string;
      id?: string;
      name?: string;
    };
  };
}

export interface SDKContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | unknown[];
  is_error?: boolean;
}

export type SDKMessage =
  | SDKSystemMessage
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKResultMessage
  | SDKStreamEvent
  | { type: string; [key: string]: unknown }; // Fallback for other types

/**
 * Runtime type guard for SDK messages
 */
export function isValidSDKMessage(msg: unknown): msg is SDKMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  if (!('type' in msg)) return false;
  return typeof (msg as { type: unknown }).type === 'string';
}

/**
 * Background shell detection result
 */
export interface BackgroundShellInfo {
  toolUseId: string;
  command: string;
  description?: string;
}

/**
 * Adaptation result with extracted metadata
 */
export interface AdaptedMessage {
  output: ClaudeOutput;
  sessionId?: string;
  checkpointUuid?: string;
  askUserQuestion?: {
    toolUseId: string;
    questions: unknown[];
  };
  backgroundShell?: BackgroundShellInfo;
}

/**
 * Adapt SDK content block to internal format
 */
function adaptContentBlock(block: SDKContentBlock): ClaudeContentBlock {
  return {
    type: block.type as ClaudeContentBlock['type'],
    text: block.text,
    thinking: block.thinking,
    id: block.id,
    name: block.name,
    input: block.input,
  };
}

/**
 * Detect AskUserQuestion tool use in content blocks
 */
function detectAskUserQuestion(
  content: SDKContentBlock[]
): { toolUseId: string; questions: unknown[] } | undefined {
  for (const block of content) {
    if (block.type === 'tool_use' && block.name === 'AskUserQuestion') {
      return {
        toolUseId: block.id || '',
        questions: (block.input as { questions?: unknown[] })?.questions || [],
      };
    }
  }
  return undefined;
}

/**
 * Common background/long-running command patterns
 * These commands typically start servers or watchers that run indefinitely
 */
const BACKGROUND_COMMAND_PATTERNS = [
  // Dev servers
  /npm\s+run\s+(dev|start|serve|watch)/i,
  /yarn\s+(dev|start|serve|watch)/i,
  /pnpm\s+(dev|start|serve|watch)/i,
  /bun\s+(run\s+)?(dev|start|serve|watch)/i,
  // npx commands that start servers
  /npx\s+.*\s+start/i,
  /npx\s+(directus|strapi|payload|keystone|medusa)\b/i,
  // Direct node/python servers
  /node\s+.*server/i,
  /python\s+.*server/i,
  /python\s+-m\s+http\.server/i,
  // Framework CLIs
  /next\s+dev/i,
  /vite\s+(dev)?/i,
  /nuxt\s+dev/i,
  /remix\s+dev/i,
  /astro\s+dev/i,
  /ng\s+serve/i,
  /vue-cli-service\s+serve/i,
  // CMS/Backend CLIs
  /directus\s+(start|dev)/i,
  /strapi\s+(start|dev)/i,
  // Other common patterns
  /nodemon/i,
  /ts-node-dev/i,
  /webpack\s+(serve|watch)/i,
  /live-server/i,
  /http-server/i,
  /serve\s+/i,
];

/**
 * Check if a command matches common background/long-running patterns
 */
function isLikelyBackgroundCommand(command: string): boolean {
  return BACKGROUND_COMMAND_PATTERNS.some(pattern => pattern.test(command));
}

/**
 * Log Write tool calls for debugging output format feature
 */
function logWriteToolUse(content: SDKContentBlock[]): void {
  for (const block of content) {
    if (block.type === 'tool_use' && block.name === 'Write') {
      const input = block.input as { file_path?: string; content?: string } | undefined;
      console.log(`[SDK Adapter] Write tool_use detected:`, {
        id: block.id,
        file_path: input?.file_path,
        content_length: input?.content?.length || 0,
      });
    }
  }
}

/**
 * Detect background shell request from markdown code block or Bash tool_use
 *
 * Detection methods (in order of priority):
 * 1. Explicit: Bash tool_use with run_in_background=true
 * 2. Markdown: ```background-shell\ncommand\n``` in text blocks
 * 3. Heuristic: Bash tool_use with command matching common background patterns
 */
function detectBackgroundShell(
  content: SDKContentBlock[]
): BackgroundShellInfo | undefined {
  // Method 1: Explicit run_in_background=true from SDK
  for (const block of content) {
    if (block.type === 'tool_use' && block.name === 'Bash') {
      const input = block.input as { command?: string; run_in_background?: boolean; description?: string } | undefined;

      // Log all Bash tool_use for debugging
      console.log(`[SDK Adapter] Bash tool_use detected:`, {
        id: block.id,
        command: input?.command?.substring(0, 100),
        run_in_background: input?.run_in_background,
        hasRunInBackground: 'run_in_background' in (input || {}),
      });

      if (input?.run_in_background === true && input?.command) {
        console.log(`[SDK Adapter] Background shell detected via run_in_background=true: ${input.command.substring(0, 50)}`);
        return {
          toolUseId: block.id || '',
          command: input.command,
          description: input.description,
        };
      }
    }
  }

  // Method 2: Markdown code block with background-shell language
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      // Match: ```background-shell\ncommand\n``` (supports multiline commands)
      const regex = /```background-shell\n([\s\S]+?)\n```/;
      const match = block.text.match(regex);

      if (match) {
        const command = match[1].trim();
        if (command) {
          console.log(`[SDK Adapter] Background shell detected via markdown block: ${command.substring(0, 50)}`);
          return {
            toolUseId: `bg-shell-${Date.now()}`,
            command,
            description: 'Background shell from markdown block',
          };
        }
      }
    }
  }

  // Method 3: Heuristic - detect common background command patterns
  // This catches cases where SDK doesn't pass run_in_background but the command
  // is clearly a long-running process (dev server, watch mode, etc.)
  for (const block of content) {
    if (block.type === 'tool_use' && block.name === 'Bash') {
      const input = block.input as { command?: string; description?: string } | undefined;

      if (input?.command && isLikelyBackgroundCommand(input.command)) {
        console.log(`[SDK Adapter] Background shell detected via heuristic pattern: ${input.command.substring(0, 50)}`);
        return {
          toolUseId: block.id || '',
          command: input.command,
          description: input.description || 'Dev server / background process',
        };
      }
    }
  }

  return undefined;
}

/**
 * Main adapter function - converts SDK message to ClaudeOutput
 */
export function adaptSDKMessage(message: SDKMessage): AdaptedMessage {
  const result: AdaptedMessage = {
    output: { type: message.type as ClaudeOutputType },
  };

  switch (message.type) {
    case 'system': {
      const sys = message as SDKSystemMessage;
      result.output = {
        type: 'system',
        subtype: sys.subtype,
        session_id: sys.session_id,
      };
      // Extract session ID from init message
      if (sys.subtype === 'init' && sys.session_id) {
        result.sessionId = sys.session_id;
      }
      // Log MCP server connection status
      if (sys.subtype === 'init' && sys.mcp_servers && sys.mcp_servers.length > 0) {
        console.log(`[SDK Adapter] MCP servers status:`);
        for (const server of sys.mcp_servers) {
          if (server.status === 'connected') {
            console.log(`  ✓ ${server.name}: connected (${server.tools?.length || 0} tools)`);
          } else if (server.status === 'failed') {
            console.error(`  ✗ ${server.name}: failed - ${server.error || 'Unknown error'}`);
          } else {
            console.log(`  ○ ${server.name}: ${server.status}`);
          }
        }
      }
      break;
    }

    case 'assistant': {
      const asst = message as SDKAssistantMessage;
      const content = asst.message.content.map(adaptContentBlock);
      // Log Write tool calls for debugging
      logWriteToolUse(asst.message.content);
      result.output = {
        type: 'assistant',
        message: {
          role: 'assistant',
          content,
        },
      };
      // Check for AskUserQuestion tool use
      const askQuestion = detectAskUserQuestion(asst.message.content);
      if (askQuestion) {
        result.askUserQuestion = askQuestion;
      }
      // Check for background shell (Bash with run_in_background=true)
      const bgShell = detectBackgroundShell(asst.message.content);
      if (bgShell) {
        result.backgroundShell = bgShell;
      }
      break;
    }

    case 'user': {
      const user = message as SDKUserMessage;
      result.output = {
        type: 'user',
        message: {
          role: 'user',
          content: user.message.content.map(adaptContentBlock),
        },
      };
      // Capture checkpoint UUID for file checkpointing
      if (user.uuid) {
        result.checkpointUuid = user.uuid;
      }
      break;
    }

    case 'result': {
      const res = message as SDKResultMessage;
      result.output = {
        type: 'result',
        subtype: res.subtype,
        session_id: res.session_id,
        is_error: res.is_error,
      };
      if (res.session_id) {
        result.sessionId = res.session_id;
      }
      break;
    }

    case 'stream_event': {
      const stream = message as SDKStreamEvent;
      const event = stream.event;

      // Only handle text/thinking deltas - tool streaming works fine already
      if (event.type === 'content_block_delta' && event.delta) {
        if (event.delta.type === 'text_delta' && event.delta.text) {
          result.output = {
            type: 'content_block_delta',
            index: event.index,
            delta: { type: 'text_delta', text: event.delta.text },
          };
        } else if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
          result.output = {
            type: 'content_block_delta',
            index: event.index,
            delta: { type: 'thinking_delta', thinking: event.delta.thinking },
          };
        }
        // Ignore input_json_delta (tool streaming) - already handled well
      }
      break;
    }

    default: {
      // Pass through unknown message types with just the type
      // Don't spread to avoid type conflicts from incompatible fields
      result.output = { type: message.type as ClaudeOutputType };
      break;
    }
  }

  return result;
}

/**
 * Extract tool_use blocks from assistant message
 * Used for creating separate tool_use events for UI display
 */
export function extractToolUses(
  assistantMessage: SDKAssistantMessage
): ClaudeOutput[] {
  const toolUses: ClaudeOutput[] = [];

  for (const block of assistantMessage.message.content) {
    if (block.type === 'tool_use') {
      toolUses.push({
        type: 'tool_use',
        id: block.id,
        tool_name: block.name,
        tool_data: { input: block.input },
      });
    }
  }

  return toolUses;
}

/**
 * Extract tool_result blocks from user message
 * Used for updating tool status in UI
 */
export function extractToolResults(
  userMessage: SDKUserMessage
): ClaudeOutput[] {
  const toolResults: ClaudeOutput[] = [];

  for (const block of userMessage.message.content) {
    if (block.type === 'tool_result') {
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.tool_use_id,
        result: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
        is_error: block.is_error,
        tool_data: { tool_use_id: block.tool_use_id },
      });
    }
  }

  return toolResults;
}
