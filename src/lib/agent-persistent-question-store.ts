/**
 * Agent Persistent Question Store - Task-scoped AskUserQuestion data that survives agent cleanup
 *
 * Extracted from agent-manager.ts. Stores pending question payloads keyed by taskId
 * so they remain accessible after the agent attempt completes or is cancelled.
 * Used when CLI auto-handles AskUserQuestion and the attempt ends before user answers.
 */

export interface PersistentQuestionData {
  attemptId: string;
  toolUseId: string;
  questions: unknown[];
  timestamp: number;
}

/**
 * PersistentQuestionStore - in-memory map of taskId → question data
 */
export class PersistentQuestionStore {
  private store = new Map<string, PersistentQuestionData>();

  /** Persist question data for a task (survives agent cleanup) */
  set(taskId: string, data: PersistentQuestionData): void {
    this.store.set(taskId, data);
  }

  /** Retrieve persisted question data for a task, or null if absent */
  get(taskId: string): PersistentQuestionData | null {
    return this.store.get(taskId) || null;
  }

  /** Remove persisted question data for a task */
  clear(taskId: string): void {
    this.store.delete(taskId);
  }
}
