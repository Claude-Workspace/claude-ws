import { create } from 'zustand';
import { Task, TaskStatus } from '@/types';

interface TaskStore {
  tasks: Task[];
  selectedTaskId: string | null;
  selectedTask: Task | null;
  isCreatingTask: boolean;
  pendingAutoStartTask: string | null;

  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  deleteTasksByStatus: (status: TaskStatus) => Promise<void>;
  selectTask: (id: string | null) => void;
  setSelectedTask: (task: Task | null) => void;
  setCreatingTask: (isCreating: boolean) => void;
  setTaskChatInit: (taskId: string, chatInit: boolean) => Promise<void>;
  setPendingAutoStartTask: (taskId: string | null) => void;
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
    const task = id ? get().tasks.find((t) => t.id === id) || null : null;
    set({ selectedTaskId: id, selectedTask: task });
  },

  setSelectedTask: (task) => set({ selectedTask: task }),

  setCreatingTask: (isCreating) => set({ isCreatingTask: isCreating }),

  setPendingAutoStartTask: (taskId) => set({ pendingAutoStartTask: taskId }),

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

      // If task was updated (existing task with same title), update it in store
      if (task.updated) {
        get().updateTask(task.id, { description: task.description });
      } else {
        get().addTask(task);
      }

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
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update task status');
      const updatedTask = await res.json();

      // Update task in list
      get().updateTask(taskId, { status });

      // Update selectedTask if it's the same task
      const selected = get().selectedTask;
      if (selected?.id === taskId) {
        set({ selectedTask: { ...selected, status } });
      }
    } catch (error) {
      console.error('Error updating task status:', error);
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
