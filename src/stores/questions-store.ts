import { create } from 'zustand';

export interface PendingQuestionEntry {
  attemptId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  toolUseId: string;
  questions: unknown[];
  timestamp: number;
}

interface QuestionsStore {
  isOpen: boolean;
  pendingQuestions: Map<string, PendingQuestionEntry>;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  fetchQuestions: (projectIds?: string[]) => Promise<void>;
  addQuestion: (entry: PendingQuestionEntry) => void;
  removeQuestion: (attemptId: string) => void;
  getCount: () => number;
  getByTaskId: (taskId: string) => PendingQuestionEntry | undefined;
}

export const useQuestionsStore = create<QuestionsStore>((set, get) => ({
  isOpen: false,
  pendingQuestions: new Map<string, PendingQuestionEntry>(),

  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),

  fetchQuestions: async (projectIds?: string[]) => {
    try {
      const params = projectIds?.length ? `?projectIds=${projectIds.join(',')}` : '';
      const res = await fetch(`/api/questions${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const newMap = new Map<string, PendingQuestionEntry>();
      for (const q of data.questions || []) {
        newMap.set(q.attemptId, q);
      }
      set({ pendingQuestions: newMap });
    } catch {
      // Silently fail — will retry on next poll
    }
  },

  addQuestion: (entry) => {
    set((state) => {
      const newMap = new Map(state.pendingQuestions);
      newMap.set(entry.attemptId, entry);
      return { pendingQuestions: newMap };
    });
  },

  removeQuestion: (attemptId) => {
    set((state) => {
      const newMap = new Map(state.pendingQuestions);
      newMap.delete(attemptId);
      return { pendingQuestions: newMap };
    });
  },

  getCount: () => {
    return get().pendingQuestions.size;
  },

  getByTaskId: (taskId) => {
    for (const entry of get().pendingQuestions.values()) {
      if (entry.taskId === taskId) return entry;
    }
    return undefined;
  },
}));
