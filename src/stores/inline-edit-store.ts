/**
 * Inline Edit Store - State management for inline AI code editing
 *
 * Manages edit sessions, streaming state, and diff preview.
 * Ephemeral store - no database persistence.
 */

import { create } from 'zustand';
import type { DiffResult } from '@/lib/diff-generator';

/**
 * Selection range in editor
 */
export interface CodeSelection {
  from: number;
  to: number;
  text: string;
  startLine: number;
  endLine: number;
}

/**
 * Edit session status
 */
export type EditSessionStatus = 'prompting' | 'generating' | 'preview' | 'applying';

/**
 * Single edit session
 */
export interface EditSession {
  sessionId: string;
  filePath: string;
  selection: CodeSelection;
  instruction: string;
  originalCode: string;
  generatedCode: string;
  diff: DiffResult | null;
  status: EditSessionStatus;
  error: string | null;
  createdAt: number;
}

/**
 * Store state
 */
interface InlineEditState {
  // Active sessions keyed by filePath (one per file)
  sessions: Record<string, EditSession>;

  // Dialog state
  dialogOpen: boolean;
  dialogFilePath: string | null;
  dialogPosition: { x: number; y: number } | null;
}

/**
 * Store actions
 */
interface InlineEditActions {
  // Session lifecycle
  startSession: (filePath: string, sessionId: string, selection: CodeSelection) => void;
  setInstruction: (filePath: string, instruction: string) => void;
  startGenerating: (filePath: string) => void;
  appendGeneratedCode: (filePath: string, chunk: string) => void;
  completeGeneration: (filePath: string, finalCode: string, diff: DiffResult) => void;
  setError: (filePath: string, error: string) => void;
  acceptEdit: (filePath: string) => string | null; // Returns generated code
  rejectEdit: (filePath: string) => void;
  cancelEdit: (filePath: string) => void;

  // Dialog control
  openDialog: (filePath: string, position?: { x: number; y: number }) => void;
  closeDialog: () => void;

  // Queries
  getSession: (filePath: string) => EditSession | null;
  hasActiveSession: (filePath: string) => boolean;
}

type InlineEditStore = InlineEditState & InlineEditActions;

export const useInlineEditStore = create<InlineEditStore>((set, get) => ({
  // Initial state
  sessions: {},
  dialogOpen: false,
  dialogFilePath: null,
  dialogPosition: null,

  // Actions
  startSession: (filePath, sessionId, selection) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [filePath]: {
          sessionId,
          filePath,
          selection,
          instruction: '',
          originalCode: selection.text,
          generatedCode: '',
          diff: null,
          status: 'prompting',
          error: null,
          createdAt: Date.now(),
        },
      },
    }));
  },

  setInstruction: (filePath, instruction) => {
    set((state) => {
      const session = state.sessions[filePath];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [filePath]: { ...session, instruction },
        },
      };
    });
  },

  startGenerating: (filePath) => {
    set((state) => {
      const session = state.sessions[filePath];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [filePath]: {
            ...session,
            status: 'generating',
            generatedCode: '',
            error: null,
          },
        },
      };
    });
  },

  appendGeneratedCode: (filePath, chunk) => {
    set((state) => {
      const session = state.sessions[filePath];
      if (!session || session.status !== 'generating') return state;
      return {
        sessions: {
          ...state.sessions,
          [filePath]: {
            ...session,
            generatedCode: session.generatedCode + chunk,
          },
        },
      };
    });
  },

  completeGeneration: (filePath, finalCode, diff) => {
    set((state) => {
      const session = state.sessions[filePath];
      if (!session) return state;
      return {
        // Keep dialog open to show preview
        sessions: {
          ...state.sessions,
          [filePath]: {
            ...session,
            status: 'preview',
            generatedCode: finalCode,
            diff,
          },
        },
      };
    });
  },

  setError: (filePath, error) => {
    set((state) => {
      const session = state.sessions[filePath];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [filePath]: {
            ...session,
            status: 'prompting',
            error,
          },
        },
      };
    });
  },

  acceptEdit: (filePath) => {
    const session = get().sessions[filePath];
    if (!session || session.status !== 'preview') return null;

    const generatedCode = session.generatedCode;

    // Remove session
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [filePath]: _removed, ...rest } = state.sessions;
      return { sessions: rest };
    });

    return generatedCode;
  },

  rejectEdit: (filePath) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [filePath]: _removed, ...rest } = state.sessions;
      return { sessions: rest };
    });
  },

  cancelEdit: (filePath) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [filePath]: _removed, ...rest } = state.sessions;
      return {
        sessions: rest,
        dialogOpen: state.dialogFilePath === filePath ? false : state.dialogOpen,
        dialogFilePath: state.dialogFilePath === filePath ? null : state.dialogFilePath,
      };
    });
  },

  openDialog: (filePath, position) => {
    set({ dialogOpen: true, dialogFilePath: filePath, dialogPosition: position || null });
  },

  closeDialog: () => {
    set({ dialogOpen: false, dialogFilePath: null, dialogPosition: null });
  },

  getSession: (filePath) => {
    return get().sessions[filePath] || null;
  },

  hasActiveSession: (filePath) => {
    return !!get().sessions[filePath];
  },
}));
