import { create } from 'zustand';
import { ProjectSettings } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProjectSettingsStore');

interface ProjectSettingsStore {
  settings: Record<string, ProjectSettings>;
  isLoading: boolean;
  isInstalling: boolean;
  fetchProjectSettings: (projectId: string) => Promise<void>;
  updateProjectSettings: (projectId: string, settings: Partial<ProjectSettings>) => Promise<void>;
  installComponents: (projectId: string) => Promise<{ installed: string[]; skipped: string[]; errors: string[] }>;
}

export const useProjectSettingsStore = create<ProjectSettingsStore>((set, get) => ({
  settings: {},
  isLoading: false,
  isInstalling: false,

  fetchProjectSettings: async (projectId: string) => {
    try {
      set({ isLoading: true });

      const response = await fetch(`/api/projects/${projectId}/settings`, {
        headers: {
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
      });

      if (!response.ok) {
        // If settings don't exist yet, return empty settings
        if (response.status === 404) {
          set((state) => ({
            settings: {
              ...state.settings,
              [projectId]: { selectedComponents: [], selectedAgentSets: [] },
            },
            isLoading: false,
          }));
          return;
        }
        throw new Error('Failed to fetch project settings');
      }

      const data = await response.json();
      set((state) => ({
        settings: {
          ...state.settings,
          [projectId]: data.settings || { selectedComponents: [], selectedAgentSets: [] },
        },
        isLoading: false,
      }));
    } catch (error) {
      log.error({ error, projectId }, 'Error fetching project settings');
      set({ isLoading: false });
    }
  },

  updateProjectSettings: async (projectId: string, newSettings: Partial<ProjectSettings>) => {
    try {
      const currentSettings = get().settings[projectId] || {
        selectedComponents: [],
        selectedAgentSets: [],
      };

      const updatedSettings: ProjectSettings = {
        selectedComponents: newSettings.selectedComponents ?? currentSettings.selectedComponents,
        selectedAgentSets: newSettings.selectedAgentSets ?? currentSettings.selectedAgentSets,
      };

      const response = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
        body: JSON.stringify({ settings: updatedSettings }),
      });

      if (!response.ok) {
        throw new Error('Failed to update project settings');
      }

      set((state) => ({
        settings: {
          ...state.settings,
          [projectId]: updatedSettings,
        },
      }));
    } catch (error) {
      log.error({ error, projectId }, 'Error updating project settings');
      throw error;
    }
  },

  installComponents: async (projectId: string) => {
    try {
      set({ isInstalling: true });

      const response = await fetch(`/api/agent-factory/projects/${projectId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to install components');
      }

      const data = await response.json();
      return {
        installed: data.installed || [],
        skipped: data.skipped || [],
        errors: data.errors || [],
      };
    } catch (error) {
      log.error({ error, projectId }, 'Error installing components');
      throw error;
    } finally {
      set({ isInstalling: false });
    }
  },
}));
