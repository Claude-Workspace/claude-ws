/**
 * Output Format Converters - HTML, Markdown, YAML, custom format handlers
 *
 * Extracted from output-formatter.ts. Each function converts ClaudeOutput[]
 * into the requested string format.
 */

import type { ClaudeOutput, ClaudeContentBlock } from '../types';

/**
 * Convert messages to HTML
 */
export function toHtml(messages: ClaudeOutput[]): string {
  const blocks = messages.map((msg, index) => {
    if (!msg.message?.content) return '';

    return msg.message.content.map((block: ClaudeContentBlock) => {
      switch (block.type) {
        case 'text':
          return `<div class="claude-message-text" data-index="${index}">
            <p>${escapeHtml(block.text || '')}</p>
          </div>`;

        case 'thinking':
          return `<details class="claude-thinking" data-index="${index}" open>
            <summary style="cursor: pointer; font-weight: bold; margin-bottom: 8px;">
              💭 Thinking
            </summary>
            <div style="margin-left: 16px; font-size: 0.9em; color: #666;">
              ${escapeHtml(block.thinking || '')}
            </div>
          </details>`;

        case 'tool_use': {
          const toolInput = typeof block.input === 'string'
            ? block.input
            : JSON.stringify(block.input, null, 2);

          return `<div class="claude-tool-use" data-index="${index}" data-tool="${block.name || 'unknown'}">
            <div style="background: #f5f5f5; border-left: 4px solid #2196F3; padding: 12px; margin: 8px 0; border-radius: 4px;">
              <strong>🔧 ${block.name || 'Unknown Tool'}</strong>
              <pre style="background: #fff; padding: 8px; margin-top: 8px; border-radius: 4px; overflow-x: auto;"><code>${escapeHtml(toolInput)}</code></pre>
            </div>
          </div>`;
        }

        case 'tool_result':
          return `<div class="claude-tool-result" data-index="${index}">
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 8px 0; border-radius: 4px;">
              <strong>📊 Tool Result</strong>
              <pre style="background: #fff; padding: 8px; margin-top: 8px; border-radius: 4px; overflow-x: auto;"><code>${escapeHtml(JSON.stringify(block.input, null, 2))}</code></pre>
            </div>
          </div>`;

        default:
          return `<div class="claude-unknown-block" data-index="${index}">
            <p>Unknown block type: ${block.type}</p>
          </div>`;
      }
    }).join('\n');
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Output</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .claude-message-text {
      background: white;
      padding: 16px;
      margin: 12px 0;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .claude-thinking {
      background: white;
      padding: 12px;
      margin: 12px 0;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .claude-tool-use, .claude-tool-result {
      margin: 16px 0;
    }
    pre {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  ${blocks}
</body>
</html>`;
}

/**
 * Convert messages to Markdown
 */
export function toMarkdown(messages: ClaudeOutput[]): string {
  const blocks = messages.map((msg) => {
    if (!msg.message?.content) return '';

    return msg.message.content.map((block: ClaudeContentBlock) => {
      switch (block.type) {
        case 'text':
          return `${block.text || ''}\n`;

        case 'thinking':
          return `> **💭 Thinking**\n> ${block.thinking || ''}\n`;

        case 'tool_use': {
          const toolInput = typeof block.input === 'string'
            ? block.input
            : JSON.stringify(block.input, null, 2);
          return `### 🔧 ${block.name || 'Unknown Tool'}\n\`\`\`\n${toolInput}\n\`\`\`\n`;
        }

        case 'tool_result':
          return `### 📊 Tool Result\n\`\`\`\n${JSON.stringify(block.input, null, 2)}\n\`\`\`\n`;

        default:
          return `> Unknown block type: ${block.type}\n`;
      }
    }).join('\n');
  }).join('\n');

  return blocks;
}

/**
 * Convert messages to YAML
 */
export function toYaml(messages: ClaudeOutput[]): string {
  const yamlMessages = messages.map((msg, index) => {
    const contentBlocks = msg.message?.content?.map((block: ClaudeContentBlock) => {
      const blockYaml: string[] = [];

      blockYaml.push(`    - type: ${block.type}`);

      if (block.type === 'text' && block.text) {
        blockYaml.push(`      text: |`);
        block.text.split('\n').forEach(line => {
          blockYaml.push(`        ${line}`);
        });
      }

      if (block.type === 'thinking' && block.thinking) {
        blockYaml.push(`      thinking: |`);
        block.thinking.split('\n').forEach(line => {
          blockYaml.push(`        ${line}`);
        });
      }

      if (block.type === 'tool_use') {
        blockYaml.push(`      id: ${block.id || 'null'}`);
        blockYaml.push(`      name: ${block.name || 'unknown'}`);
        if (block.input) {
          blockYaml.push(`      input: ${JSON.stringify(block.input)}`);
        }
      }

      if (block.type === 'tool_result') {
        if (block.id) blockYaml.push(`      tool_use_id: ${block.id}`);
        if (block.input) blockYaml.push(`      content: ${JSON.stringify(block.input)}`);
      }

      return blockYaml.join('\n');
    }) || [];

    return `  - index: ${index}
    type: ${msg.type}
    ${msg.id ? `id: ${msg.id}` : ''}
    ${msg.message?.role ? `role: ${msg.message.role}` : ''}
    content:
    ${contentBlocks.join('\n    ')}`;
  }).join('\n');

  return `messages:\n${yamlMessages}`;
}

/**
 * Convert messages to JSON (default)
 */
export function toJson(messages: ClaudeOutput[]): string {
  return JSON.stringify(messages, null, 2);
}

/**
 * Extract custom format from Claude's response.
 * Returns text content as-is; schema instructions are applied when calling Claude.
 */
export function extractCustomFormat(messages: ClaudeOutput[], _schema: string | null): string {
  const textBlocks = messages
    .map(msg => msg.message?.content || [])
    .flat()
    .filter((block: ClaudeContentBlock) => block.type === 'text')
    .map((block: ClaudeContentBlock) => block.text || '')
    .join('\n\n');

  if (!textBlocks.trim()) {
    const codeBlocks = messages
      .map(msg => msg.message?.content || [])
      .flat()
      .filter((block: ClaudeContentBlock) => block.type === 'tool_use' || block.type === 'tool_result')
      .map((block: ClaudeContentBlock) => {
        if (block.type === 'tool_use' && block.input) {
          return typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2);
        }
        if (block.type === 'tool_result' && block.input) {
          return JSON.stringify(block.input, null, 2);
        }
        return '';
      })
      .join('\n\n');

    return codeBlocks.trim() || textBlocks;
  }

  return textBlocks.trim() || 'No content available';
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
