import { create } from 'zustand';
import type { Task } from '@/types';
import { useZIndexStore } from './z-index-store';

/**
 * Store for managing multiple floating chat windows.
 * When chat is in floating mode, clicking tasks opens new windows instead of replacing.
 */

export interface FloatingWindow {
  id: string; // Same as taskId for uniqueness
  task: Task;
  zIndex: number; // For window stacking order
}

interface FloatingWindowsState {
  windows: FloatingWindow[];
  isFloatingMode: boolean; // Whether floating mode is active

  // Actions
  openWindow: (task: Task) => void;
  closeWindow: (taskId: string) => void;
  closeAllWindows: () => void;
  closeWindowsNotInProjects: (projectIds: string[]) => void; // Close windows for tasks not in selected projects
  focusWindow: (taskId: string) => void;
  setFloatingMode: (enabled: boolean) => void;
  updateWindowTask: (taskId: string, updates: Partial<Task>) => void;
}

// Read initial floating mode state from localStorage (must be synchronous for store initialization)
const getInitialFloatingMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('chat-window-detached') === 'true';
  } catch {
    return false;
  }
};

export const useFloatingWindowsStore = create<FloatingWindowsState>((set, get) => ({
  windows: [],
  isFloatingMode: getInitialFloatingMode(),

  openWindow: (task: Task) => {
    const { windows } = get();

    // Check if window for this task already exists
    const existingWindow = windows.find(w => w.id === task.id);
    if (existingWindow) {
      // Focus existing window instead of opening new one
      get().focusWindow(task.id);
      return;
    }

    // Get next z-index from global store
    const zIndex = useZIndexStore.getState().getNextZIndex();

    // Add new window with highest z-index
    set({
      windows: [
        ...windows,
        {
          id: task.id,
          task,
          zIndex,
        },
      ],
    });
  },

  closeWindow: (taskId: string) => {
    set(state => ({
      windows: state.windows.filter(w => w.id !== taskId),
    }));
  },

  closeAllWindows: () => {
    set({ windows: [], isFloatingMode: false });
  },

  closeWindowsNotInProjects: (projectIds: string[]) => {
    // If projectIds is empty (all projects mode), keep all windows open
    if (projectIds.length === 0) return;

    set(state => ({
      windows: state.windows.filter(w => projectIds.includes(w.task.projectId)),
    }));
  },

  focusWindow: (taskId: string) => {
    const { windows } = get();
    const zIndex = useZIndexStore.getState().getNextZIndex();
    set({
      windows: windows.map(w =>
        w.id === taskId ? { ...w, zIndex } : w
      ),
    });
  },

  setFloatingMode: (enabled: boolean) => {
    set({ isFloatingMode: enabled });
    // When disabling floating mode, close all windows
    if (!enabled) {
      set({ windows: [] });
    }
  },

  updateWindowTask: (taskId: string, updates: Partial<Task>) => {
    set(state => ({
      windows: state.windows.map(w =>
        w.id === taskId ? { ...w, task: { ...w.task, ...updates } } : w
      ),
    }));
  },
}));
