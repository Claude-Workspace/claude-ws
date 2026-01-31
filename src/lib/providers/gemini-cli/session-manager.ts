/**
 * Gemini CLI Session Manager
 *
 * Manages session UUIDs for Gemini CLI per task.
 * Gemini CLI uses UUIDs for --resume flag (captured from init event's session_id).
 * We map task IDs to session UUIDs to maintain conversation context.
 */

import { db } from '@/lib/db';
import { geminiSessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Get session UUID for a task
 * @param taskId - The task ID
 * @param projectPath - Project path (sessions are per task + path)
 * @returns Session UUID or null if no session exists
 */
export async function getSessionUuid(
  taskId: string,
  projectPath: string
): Promise<string | null> {
  const existing = await db
    .select()
    .from(geminiSessions)
    .where(
      and(
        eq(geminiSessions.taskId, taskId),
        eq(geminiSessions.projectPath, projectPath)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log('[GeminiSession] Found existing session:', {
      taskId,
      sessionUuid: existing[0].sessionUuid,
    });
    return existing[0].sessionUuid;
  }

  console.log('[GeminiSession] No existing session for task:', taskId);
  return null;
}

/**
 * Save or update session UUID for a task
 * Called when we receive init event with session_id from Gemini CLI
 * @param taskId - The task ID
 * @param projectPath - Project path
 * @param sessionUuid - The session UUID from Gemini CLI init event
 */
export async function saveSessionUuid(
  taskId: string,
  projectPath: string,
  sessionUuid: string
): Promise<void> {
  const existing = await db
    .select()
    .from(geminiSessions)
    .where(
      and(
        eq(geminiSessions.taskId, taskId),
        eq(geminiSessions.projectPath, projectPath)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing record with new session UUID
    await db
      .update(geminiSessions)
      .set({
        sessionUuid,
        updatedAt: Date.now(),
      })
      .where(eq(geminiSessions.id, existing[0].id));

    console.log('[GeminiSession] Updated session UUID:', {
      taskId,
      sessionUuid,
    });
  } else {
    // Create new record
    await db.insert(geminiSessions).values({
      id: nanoid(),
      taskId,
      projectPath,
      sessionUuid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log('[GeminiSession] Created session record:', {
      taskId,
      projectPath,
      sessionUuid,
    });
  }
}

/**
 * Delete session for a task (called when task is deleted)
 * @param taskId - The task ID
 */
export async function deleteTaskSessions(taskId: string): Promise<void> {
  await db.delete(geminiSessions).where(eq(geminiSessions.taskId, taskId));
  console.log('[GeminiSession] Deleted sessions for task:', taskId);
}

// Legacy exports for backward compatibility (will be removed)
export const getSessionIndex = getSessionUuid;
export const updateSessionIndex = saveSessionUuid;
