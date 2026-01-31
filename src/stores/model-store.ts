'use client';

import { create } from 'zustand';
import { Model, DEFAULT_MODEL_ID, getModelShortName } from '@/lib/models';

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
      console.error('Error loading models:', error);
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
            console.log('[ModelStore] Task not found (temp task), keeping local state only');
            return;
          }
          // Rollback on other errors
          const newTaskModels = { ...taskModels };
          delete newTaskModels[taskId];
          set({ taskModels: newTaskModels });
          const errorText = await response.text();
          console.error('Failed to save task model:', response.status, errorText);
          throw new Error(`Failed to save task model: ${response.status}`);
        }
      } catch (error) {
        console.error('Error setting model:', error);
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
        console.error('Error setting model:', error);
      }
    }
  },

  // Get model for a specific task
  getTaskModel: (taskId: string, taskLastModel?: string | null) => {
    const { taskModels, defaultModel } = get();
    // Priority: local state > task.lastModel > default
    return taskModels[taskId] || taskLastModel || defaultModel;
  },

  getShortName: (taskId?: string, taskLastModel?: string | null) => {
    const { taskModels, defaultModel } = get();
    const model = taskId
      ? taskModels[taskId] || taskLastModel || defaultModel
      : defaultModel;
    return getModelShortName(model || defaultModel);
  },
}));
