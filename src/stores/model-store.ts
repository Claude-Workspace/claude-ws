'use client';

import { create } from 'zustand';
import { Model, DEFAULT_MODEL_ID, getModelShortName } from '@/lib/models';
import { createLogger } from '@/lib/logger';

const log = createLogger('ModelStore');

interface ModelStore {
  // Global default model (from env/cached/default)
  defaultModel: string;
  // Per-task model overrides
  taskModels: Record<string, string>;
  availableModels: Model[];
  isLoading: boolean;
  source: 'env' | 'cached' | 'default' | null;
  loadModels: () => Promise<void>;
  setModel: (modelId: string, taskId?: string) => Promise<void>;
  getTaskModel: (taskId: string, taskLastModel?: string | null) => string;
  getShortName: (taskId?: string, taskLastModel?: string | null) => string;
}

export const useModelStore = create<ModelStore>((set, get) => ({
  defaultModel: DEFAULT_MODEL_ID,
  taskModels: {},
  availableModels: [],
  isLoading: false,
  source: null,

  loadModels: async () => {
    try {
      set({ isLoading: true });

      const response = await fetch('/api/models', {
        headers: {
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      set({
        availableModels: data.models,
        defaultModel: data.current,
        source: data.source,
        isLoading: false,
      });
    } catch (error) {
      log.error({ error }, 'Error loading models');
      set({ isLoading: false });
    }
  },

  // Set model for a task (saves to task.lastModel)
  setModel: async (modelId: string, taskId?: string) => {
    const { taskModels } = get();

    if (taskId) {
      // Update local state for this task
      set({ taskModels: { ...taskModels, [taskId]: modelId } });

      // Save to task's lastModel
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': localStorage.getItem('apiKey') || '',
          },
          body: JSON.stringify({ lastModel: modelId }),
        });

        if (!response.ok) {
          // 404 is expected for temp tasks (task not yet created)
          // Keep local state but don't throw - task will get model on creation
          if (response.status === 404) {
            log.debug({ taskId }, 'Task not found (temp task), keeping local state only');
            return;
          }
          // Rollback on other errors
          const newTaskModels = { ...taskModels };
          delete newTaskModels[taskId];
          set({ taskModels: newTaskModels });
          const errorText = await response.text();
          log.error({ status: response.status, errorText }, 'Failed to save task model');
          throw new Error(`Failed to save task model: ${response.status}`);
        }
      } catch (error) {
        log.error({ error, taskId }, 'Error setting model');
      }
    } else {
      // No taskId: save as global default
      try {
        const response = await fetch('/api/models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': localStorage.getItem('apiKey') || '',
          },
          body: JSON.stringify({ model: modelId }),
        });

        if (!response.ok) {
          throw new Error('Failed to save model');
        }

        set({ defaultModel: modelId, source: 'cached' });
      } catch (error) {
        log.error({ error, modelId }, 'Error setting model');
      }
    }
  },

  // Get model for a specific task
  getTaskModel: (taskId: string, taskLastModel?: string | null) => {
    const { taskModels, defaultModel, availableModels } = get();
    // Priority: local state > task.lastModel > default
    const candidate = taskModels[taskId] || taskLastModel || defaultModel;

    // Validate that the model exists in available models
    // If not (due to provider change), fall back to default
    if (availableModels.length > 0 && candidate !== defaultModel) {
      const modelExists = availableModels.some((m) => m.id === candidate);
      if (!modelExists) {
        return defaultModel;
      }
    }

    return candidate;
  },

  getShortName: (taskId?: string, taskLastModel?: string | null) => {
    const { taskModels, defaultModel, availableModels } = get();
    let model = taskId
      ? taskModels[taskId] || taskLastModel || defaultModel
      : defaultModel;

    // Validate that the model exists in available models
    // If not (due to provider change), fall back to default
    if (availableModels.length > 0 && model !== defaultModel) {
      const modelExists = availableModels.some((m) => m.id === model);
      if (!modelExists) {
        model = defaultModel;
      }
    }

    return getModelShortName(model || defaultModel);
  },
}));
