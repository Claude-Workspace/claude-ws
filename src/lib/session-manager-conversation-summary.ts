/**
 * Session Manager Conversation Summary
 *
 * Extracts a plain-text summary of a task's conversation history from attempt logs.
 * Used by compact to carry context into a fresh session after the token limit is hit.
 */

import { db, schema } from '@/lib/db';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('SessionConversationSummary');

/**
 * Extract a conversation summary from a task's attempt logs.
 * Returns the original prompt + last assistant message text (up to 4000 chars).
 */
export async function getConversationSummary(taskId: string): Promise<string> {
  // Get the most recent completed/cancelled attempt
  const lastAttempt = await db.query.attempts.findFirst({
    where: and(
      eq(schema.attempts.taskId, taskId),
      inArray(schema.attempts.status, ['completed', 'cancelled'])
    ),
    orderBy: [desc(schema.attempts.createdAt)],
  });

  if (!lastAttempt) return '';

  // Get the original prompt from the first attempt for this task
  const firstAttempt = await db.query.attempts.findFirst({
    where: eq(schema.attempts.taskId, taskId),
    orderBy: [schema.attempts.createdAt],
  });
  const originalPrompt = firstAttempt?.displayPrompt || firstAttempt?.prompt || '';

  // Get the last assistant message from the most recent attempt's logs
  const logs = await db.query.attemptLogs.findMany({
    where: eq(schema.attemptLogs.attemptId, lastAttempt.id),
  });

  let lastAssistantText = '';
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].type !== 'json') continue;
    try {
      const data = JSON.parse(logs[i].content);
      if (data.type === 'assistant' && data.message?.content) {
        const text = data.message.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join(' ');
        if (text.trim()) {
          lastAssistantText = text.substring(0, 4000);
          break;
        }
      }
    } catch {
      // Skip parse errors
    }
  }

  let summary = '';
  if (originalPrompt) summary += `Original task: ${originalPrompt.substring(0, 500)}\n\n`;
  if (lastAssistantText) summary += `Most recent assistant response:\n${lastAssistantText}`;

  return summary;
}
