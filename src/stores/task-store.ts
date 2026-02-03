import { create } from 'zustand';
import { Task, TaskStatus } from '@/types';
import { useInteractiveCommandStore } from './interactive-command-store';
import { useFloatingWindowsStore } from './floating-windows-store';

interface TaskStore {
  tasks: Task[];
  selectedTaskId: string | null;
  selectedTask: Task | null;
  isCreatingTask: boolean;
  pendingAutoStartTask: string | null;
  pendingAutoStartPrompt: string | null;
  pendingAutoStartFileIds: string[] | null;

  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  deleteTasksByStatus: (status: TaskStatus) => Promise<void>;
  selectTask: (id: string | null) => void;
  setSelectedTask: (task: Task | null) => void;
  setSelectedTaskId: (id: string | null) => void;  // Update ID only (for floating windows)
  setCreatingTask: (isCreating: boolean) => void;
  setTaskChatInit: (taskId: string, chatInit: boolean) => Promise<void>;
  setPendingAutoStartTask: (taskId: string | null, prompt?: string, fileIds?: string[]) => void;
  moveTaskToInProgress: (taskId: string) => Promise<void>;

  // API calls
  fetchTasks: (projectIds: string[]) => Promise<void>;
  createTask: (projectId: string, title: string, description: string | null) => Promise<Task>;
  reorderTasks: (taskId: string, newStatus: TaskStatus, newPosition: number) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  selectedTask: null,
  isCreatingTask: false,
  pendingAutoStartTask: null,
  pendingAutoStartPrompt: null,
  pendingAutoStartFileIds: null,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => set((state) => ({
    tasks: [...state.tasks, task]
  })),

  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map((task) =>
      task.id === id ? { ...task, ...updates } : task
    ),
  })),

  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter((task) => task.id !== id),
  })),

  deleteTasksByStatus: async (status: TaskStatus) => {
    const tasksToDelete = get().tasks.filter((task) => task.status === status);

    // Optimistic update
    set((state) => ({
      tasks: state.tasks.filter((task) => task.status !== status),
    }));

    try {
      // Delete all tasks with the given status
      await Promise.all(
        tasksToDelete.map((task) =>
          fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
        )
      );
    } catch (error) {
      console.error('Error deleting tasks by status:', error);
      // Revert on failure
      set((state) => ({
        tasks: [...state.tasks, ...tasksToDelete],
      }));
      throw error;
    }
  },

  selectTask: (id) => {
    // Close interactive command when switching to a different task
    const currentTaskId = get().selectedTaskId;
    if (id !== currentTaskId) {
      useInteractiveCommandStore.getState().closeCommand();
    }

    const task = id ? get().tasks.find((t) => t.id === id) || null : null;

    // Check if we should open as floating window:
    // 1. There are already floating windows open, OR
    // 2. User preference is set to floating (last closed was floating)
    const floatingWindowsStore = useFloatingWindowsStore.getState();
    const hasFloatingWindows = floatingWindowsStore.windows.size > 0;
    const preferFloating = floatingWindowsStore.preferFloating;

    if (task && (hasFloatingWindows || preferFloating)) {
      // Check if this task already has a floating window
      if (floatingWindowsStore.isWindowOpen(task.id)) {
        // Bring existing window to front
        floatingWindowsStore.bringToFront(task.id);
      } else {
        // Open new floating window for this task
        floatingWindowsStore.openWindow(task.id, 'chat', task.projectId);
      }
      // Update selectedTaskId but keep selectedTask null (panel closed)
      set({ selectedTaskId: id, selectedTask: null });
      return;
    }

    // Opening in panel - set preference to panel
    if (task) {
      floatingWindowsStore.setPreferFloating(false);
    }

    set({ selectedTaskId: id, selectedTask: task });
  },

  setSelectedTask: (task) => {
    // Opening in panel - set preference to panel
    if (task) {
      useFloatingWindowsStore.getState().setPreferFloating(false);
    }
    set({ selectedTask: task, selectedTaskId: task?.id || null });
  },

  // Update selectedTaskId only (for floating windows - doesn't open panel)
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),

  setCreatingTask: (isCreating) => set({ isCreatingTask: isCreating }),

  setPendingAutoStartTask: (taskId, prompt, fileIds) => set({
    pendingAutoStartTask: taskId,
    pendingAutoStartPrompt: prompt || null,
    pendingAutoStartFileIds: fileIds || null
  }),

  moveTaskToInProgress: async (taskId: string) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);

    // Only move if not already in_progress
    if (!task || task.status === 'in_progress') return;

    // Optimistic update
    get().updateTask(taskId, { status: 'in_progress' as TaskStatus });

    // Update selectedTask if it's the same task
    if (state.selectedTask?.id === taskId) {
      set({ selectedTask: { ...state.selectedTask, status: 'in_progress' as TaskStatus } });
    }

    try {
      await get().updateTaskStatus(taskId, 'in_progress');
    } catch (error) {
      // Revert on failure
      get().updateTask(taskId, { status: task.status });
      const selected = get().selectedTask;
      if (selected?.id === taskId) {
        set({ selectedTask: { ...selected, status: task.status } });
      }
      console.error('Error moving task to in_progress:', error);
    }
  },

  fetchTasks: async (projectIds: string[]) => {
    try {
      // Build query string based on projectIds
      const query = projectIds.length > 0
        ? `?projectIds=${projectIds.join(',')}`
        : ''; // Empty = fetch all tasks
      const res = await fetch(`/api/tasks${query}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const tasks = await res.json();
      set({ tasks });
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  },

  createTask: async (projectId: string, title: string, description: string | null) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title, description }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const task = await res.json();

      get().addTask(task);
      get().setCreatingTask(false);
      return task;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  reorderTasks: async (taskId: string, newStatus: TaskStatus, newPosition: number) => {
    const oldTasks = get().tasks;

    // Optimistic update
    const task = oldTasks.find((t) => t.id === taskId);
    if (!task) return;

    const tasksInNewColumn = oldTasks
      .filter((t) => t.status === newStatus && t.id !== taskId)
      .sort((a, b) => a.position - b.position);

    tasksInNewColumn.splice(newPosition, 0, { ...task, status: newStatus });

    const updatedTasks = oldTasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, status: newStatus, position: newPosition };
      }
      const idx = tasksInNewColumn.findIndex((nt) => nt.id === t.id);
      if (idx >= 0 && t.status === newStatus) {
        return { ...t, position: idx };
      }
      return t;
    });

    set({ tasks: updatedTasks });

    try {
      const res = await fetch('/api/tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: newStatus, position: newPosition }),
      });
      if (!res.ok) {
        // Revert on failure
        set({ tasks: oldTasks });
        throw new Error('Failed to reorder tasks');
      }
    } catch (error) {
      console.error('Error reordering tasks:', error);
      set({ tasks: oldTasks });
    }
  },

  updateTaskStatus: async (taskId: string, status: TaskStatus) => {
    const oldTasks = get().tasks;
    const task = oldTasks.find((t) => t.id === taskId);
    if (!task) return;

    // If status is changing, move task to position 0 (top of the new status list)
    const isStatusChanging = task.status !== status;
    const newPosition = isStatusChanging ? 0 : task.position;

    // Optimistic update: update task and shift other tasks' positions if needed
    if (isStatusChanging) {
      const updatedTasks = oldTasks.map((t) => {
        if (t.id === taskId) {
          return { ...t, status, position: 0 };
        }
        // Shift existing tasks in the new status column down by 1
        if (t.status === status) {
          return { ...t, position: t.position + 1 };
        }
        return t;
      });
      set({ tasks: updatedTasks });

      // Update selectedTask if it's the same task
      const selected = get().selectedTask;
      if (selected?.id === taskId) {
        set({ selectedTask: { ...selected, status, position: 0 } });
      }
    }

    try {
      // Use reorder endpoint to update both status and position
      const res = await fetch('/api/tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status, position: newPosition }),
      });
      if (!res.ok) throw new Error('Failed to update task status');
    } catch (error) {
      console.error('Error updating task status:', error);
      // Revert on failure
      set({ tasks: oldTasks });
      const selected = get().selectedTask;
      if (selected?.id === taskId && task) {
        set({ selectedTask: { ...selected, status: task.status, position: task.position } });
      }
    }
  },

  setTaskChatInit: async (taskId: string, chatInit: boolean) => {
    // Optimistic update
    get().updateTask(taskId, { chatInit });

    // Update selectedTask if it's the same task
    const selected = get().selectedTask;
    if (selected?.id === taskId) {
      set({ selectedTask: { ...selected, chatInit } });
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInit }),
      });
      if (!res.ok) throw new Error('Failed to update task chatInit');
    } catch (error) {
      console.error('Error updating task chatInit:', error);
      // Revert on failure
      get().updateTask(taskId, { chatInit: !chatInit });
      const selected = get().selectedTask;
      if (selected?.id === taskId) {
        set({ selectedTask: { ...selected, chatInit: !chatInit } });
      }
    }
  },
}));
