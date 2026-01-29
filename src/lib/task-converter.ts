/**
 * Task Converter - Convert between SDK task format and internal task format
 */

import type { SDKTask, Task, TaskStatus } from '@/types';

/**
 * SDK Task status to internal Task status mapping
 */
const SDK_STATUS_MAPPING: Record<string, TaskStatus> = {
  'pending': 'todo',
  'in_progress': 'in_progress',
  'in_review': 'in_review',
  'completed': 'done',
  'cancelled': 'cancelled',
};

/**
 * Internal Task status to SDK Task status mapping
 */
const INTERNAL_STATUS_MAPPING: Record<TaskStatus, 'pending' | 'in_progress' | 'in_review' | 'completed' | 'cancelled'> = {
  'todo': 'pending',
  'in_progress': 'in_progress',
  'in_review': 'in_review',
  'done': 'completed',
  'cancelled': 'cancelled',
};

/**
 * Convert SDK task to internal Task format
 */
export function convertSDKTaskToInternal(
  sdkTask: SDKTask,
  projectId: string,
  attemptId?: string
): Task {
  return {
    id: sdkTask.id,
    projectId,
    title: sdkTask.title,
    description: sdkTask.description || null,
    status: SDK_STATUS_MAPPING[sdkTask.status] || 'todo',
    position: sdkTask.position,
    chatInit: false, // SDK tasks don't have chatInit initially
    createdAt: sdkTask.createdAt,
    updatedAt: sdkTask.updatedAt,
    source: 'sdk',
    attemptId,
    blocks: sdkTask.blocks || [],
    blockedBy: sdkTask.blockedBy || [],
  };
}

/**
 * Convert internal Task to SDK task format
 */
export function convertInternalTaskToSDK(
  task: Task,
  taskType: 'create' | 'update'
): Omit<SDKTask, 'id' | 'position' | 'createdAt' | 'updatedAt'> {
  return {
    title: task.title,
    description: task.description || undefined,
    status: INTERNAL_STATUS_MAPPING[task.status],
    metadata: {
      source: 'sdk',
      attemptId: task.attemptId,
    },
  };
}

/**
 * Validate SDK task data
 */
export function validateSDKTask(sdkTask: unknown): sdkTask is SDKTask {
  if (typeof sdkTask !== 'object' || sdkTask === null) {
    return false;
  }

  const task = sdkTask as Record<string, unknown>;

  // Required fields
  const requiredFields = ['id', 'title', 'status', 'createdAt', 'updatedAt'];
  for (const field of requiredFields) {
    if (!(field in task)) {
      return false;
    }
  }

  // Validate types
  if (typeof task.id !== 'string') return false;
  if (typeof task.title !== 'string') return false;
  if (task.description !== undefined && typeof task.description !== 'string') return false;
  if (typeof task.status !== 'string') return false;
  if (typeof task.createdAt !== 'number') return false;
  if (typeof task.updatedAt !== 'number') return false;

  // Validate status
  const validStatuses = ['pending', 'in_progress', 'in_review', 'completed', 'cancelled'];
  if (!validStatuses.includes(task.status)) {
    return false;
  }

  return true;
}

/**
 * Deduplicate tasks based on ID
 */
export function deduplicateTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter(task => {
    if (seen.has(task.id)) {
      return false;
    }
    seen.add(task.id);
    return true;
  });
}

/**
 * Parse SDK Task tool input
 * Task tool input format from SDK:
 * {
 *   subagent_type: "TaskCreate" | "TaskUpdate",
 *   prompt: string,
 *   [other fields based on subagent_type]
 * }
 */
export interface SDKTaskToolInput {
  subagent_type?: string;
  prompt?: string;
  subject?: string;
  description?: string;
  activeForm?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  taskId?: string;
  addBlockedBy?: string[];
  addBlocks?: string[];
}

/**
 * Extract task data from SDK Task tool input
 */
export function extractTaskDataFromToolInput(
  toolInput: unknown
): { taskType: 'create' | 'update'; taskData: Partial<SDKTask> } | null {
  if (typeof toolInput !== 'object' || toolInput === null) {
    return null;
  }

  const input = toolInput as SDKTaskToolInput;

  // Determine if this is TaskCreate or TaskUpdate
  const taskType = input.subagent_type === 'TaskCreate' ? 'create' : 'update';

  // Extract task data
  const taskData: Partial<SDKTask> = {
    id: input.taskId || `sdk-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: input.subject || input.prompt || 'Untitled Task',
    description: input.description,
    status: input.status || 'pending',
  };

  // Add dependencies if present
  if (input.addBlockedBy && input.addBlockedBy.length > 0) {
    taskData.blockedBy = input.addBlockedBy;
  }
  if (input.addBlocks && input.addBlocks.length > 0) {
    taskData.blocks = input.addBlocks;
  }

  return { taskType, taskData };
}
