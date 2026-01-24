import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { AttemptStatus } from '@/types';

export interface WaitForCompletionOptions {
  timeout?: number; // Default: 5 minutes (300000ms)
  pollInterval?: number; // Default: 500ms
}

export interface WaitForCompletionResult {
  attempt: {
    id: string;
    taskId: string;
    prompt: string;
    status: AttemptStatus;
    createdAt: number;
    completedAt: number | null;
  };
  timedOut: boolean;
}

/**
 * Wait for an attempt to complete by polling the database
 * @param attemptId - The attempt ID to wait for
 * @param options - Optional configuration for timeout and poll interval
 * @returns The final attempt status and whether it timed out
 */
export async function waitForAttemptCompletion(
  attemptId: string,
  options: WaitForCompletionOptions = {}
): Promise<WaitForCompletionResult> {
  const {
    timeout = 300000, // 5 minutes default
    pollInterval = 500, // 500ms default
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Fetch current attempt status
    const attempt = await db.query.attempts.findFirst({
      where: eq(schema.attempts.id, attemptId)
    });

    if (!attempt) {
      throw new Error(`Attempt ${attemptId} not found`);
    }

    // Check if attempt is in a terminal state
    if (['completed', 'failed', 'cancelled'].includes(attempt.status)) {
      return {
        attempt: {
          id: attempt.id,
          taskId: attempt.taskId,
          prompt: attempt.prompt,
          status: attempt.status as AttemptStatus,
          createdAt: attempt.createdAt,
          completedAt: attempt.completedAt
        },
        timedOut: false
      };
    }

    // Wait before next poll
    await sleep(pollInterval);
  }

  // Timeout reached, but return current attempt state
  const finalAttempt = await db.query.attempts.findFirst({
    where: eq(schema.attempts.id, attemptId)
  });

  if (!finalAttempt) {
    throw new Error(`Attempt ${attemptId} not found`);
  }

  return {
    attempt: {
      id: finalAttempt.id,
      taskId: finalAttempt.taskId,
      prompt: finalAttempt.prompt,
      status: finalAttempt.status as AttemptStatus,
      createdAt: finalAttempt.createdAt,
      completedAt: finalAttempt.completedAt
    },
    timedOut: true
  };
}

/**
 * Sleep utility for polling
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Error class for attempt timeout
 */
export class AttemptTimeoutError extends Error {
  constructor(
    message: string,
    public attemptId: string,
    public outputFormat?: string
  ) {
    super(message);
    this.name = 'AttemptTimeoutError';
  }
}
