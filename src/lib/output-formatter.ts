import type { ClaudeOutput, OutputFormat, FormattedResponse } from '../types';

import { createLogger } from './logger';
import { toHtml, toMarkdown, toYaml, toJson, extractCustomFormat } from './output-format-converters';

const log = createLogger('OutputFormatter');

/**
 * Convert ClaudeOutput array to requested format
 */
export function formatOutput(
  messages: ClaudeOutput[],
  format: OutputFormat,
  schema: string | null,
  attemptMetadata: {
    id: string;
    taskId: string;
    prompt: string;
    status: string;
    createdAt: number;
    completedAt: number | null;
  }
): FormattedResponse {
  try {
    let formattedData: string;

    switch (format) {
      case 'html':
        formattedData = toHtml(messages);
        break;
      case 'markdown':
        formattedData = toMarkdown(messages);
        break;
      case 'yaml':
        formattedData = toYaml(messages);
        break;
      case 'raw':
        formattedData = toJson(messages);
        break;
      case 'custom':
        // For custom format, extract text from Claude's response
        // The schema is used as instructions when calling Claude
        // Here we just return the raw text content from messages
        formattedData = extractCustomFormat(messages, schema);
        break;
      case 'json':
      default:
        formattedData = toJson(messages);
        break;
    }

    return {
      formatted_data: formattedData,
      format,
      attempt: {
        id: attemptMetadata.id,
        taskId: attemptMetadata.taskId,
        prompt: attemptMetadata.prompt,
        status: attemptMetadata.status as any,
        createdAt: attemptMetadata.createdAt,
        completedAt: attemptMetadata.completedAt
      }
    };
  } catch (error) {
    log.error({ error }, 'Format conversion failed, falling back to JSON');
    return {
      formatted_data: toJson(messages),
      format: 'json',
      attempt: {
        id: attemptMetadata.id,
        taskId: attemptMetadata.taskId,
        prompt: attemptMetadata.prompt,
        status: attemptMetadata.status as any,
        createdAt: attemptMetadata.createdAt,
        completedAt: attemptMetadata.completedAt
      }
    };
  }
}
