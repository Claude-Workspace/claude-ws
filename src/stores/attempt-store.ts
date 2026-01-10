import { create } from 'zustand';
import type { AttemptStatus, ClaudeOutput } from '@/types';

interface AttemptMessage {
  id: number;
  data: ClaudeOutput;
  timestamp: number;
}

interface AttemptState {
  currentAttemptId: string | null;
  messages: AttemptMessage[];
  status: AttemptStatus | null;
  loading: boolean;
}

interface AttemptActions {
  setCurrentAttempt: (attemptId: string | null) => void;
  addMessage: (data: ClaudeOutput) => void;
  setStatus: (status: AttemptStatus) => void;
  clearMessages: () => void;
}

type AttemptStore = AttemptState & AttemptActions;

let messageIdCounter = 0;

export const useAttemptStore = create<AttemptStore>((set) => ({
  // Initial state
  currentAttemptId: null,
  messages: [],
  status: null,
  loading: false,

  // Actions
  setCurrentAttempt: (attemptId) => {
    set({
      currentAttemptId: attemptId,
      messages: [],
      status: attemptId ? 'running' : null,
      loading: false,
    });
  },

  addMessage: (data) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: messageIdCounter++,
          data,
          timestamp: Date.now(),
        },
      ],
    }));
  },

  setStatus: (status) => {
    set({ status });
  },

  clearMessages: () => {
    set({ messages: [], status: null, currentAttemptId: null });
  },
}));
