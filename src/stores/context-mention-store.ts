/**
 * Store for managing file/line context mentions
 *
 * Handles mentions added via:
 * - @filename in prompt input
 * - Cmd+L selection in editor
 */

import { create } from 'zustand';

export interface LineMention {
  type: 'lines';
  filePath: string;    // Full relative path
  fileName: string;    // Just filename
  startLine: number;
  endLine: number;
  displayName: string; // @filename#L17-27
}

export interface FileMention {
  type: 'file';
  filePath: string;    // Full relative path
  fileName: string;    // Just filename
  displayName: string; // @filename
}

export type ContextMention = LineMention | FileMention;

interface ContextMentionState {
  // Mentions keyed by taskId
  mentionsByTask: Record<string, ContextMention[]>;

  // Actions
  getMentions: (taskId: string) => ContextMention[];
  addFileMention: (taskId: string, fileName: string, filePath: string) => void;
  addLineMention: (taskId: string, fileName: string, filePath: string, startLine: number, endLine: number) => void;
  removeMention: (taskId: string, displayName: string) => void;
  clearMentions: (taskId: string) => void;

  // Get final prompt with @filepath references
  buildPromptWithMentions: (taskId: string, prompt: string) => { finalPrompt: string; displayPrompt: string };
}

export const useContextMentionStore = create<ContextMentionState>((set, get) => ({
  mentionsByTask: {},

  getMentions: (taskId) => {
    return get().mentionsByTask[taskId] || [];
  },

  addFileMention: (taskId, fileName, filePath) => {
    const displayName = `@${fileName}`;

    set((state) => {
      const existing = state.mentionsByTask[taskId] || [];
      // Don't add duplicate
      if (existing.some(m => m.displayName === displayName)) {
        return state;
      }

      return {
        mentionsByTask: {
          ...state.mentionsByTask,
          [taskId]: [
            ...existing,
            {
              type: 'file',
              filePath,
              fileName,
              displayName,
            },
          ],
        },
      };
    });
  },

  addLineMention: (taskId, fileName, filePath, startLine, endLine) => {
    const lineRange = startLine === endLine ? `L${startLine}` : `L${startLine}-${endLine}`;
    const displayName = `@${fileName}#${lineRange}`;

    set((state) => {
      const existing = state.mentionsByTask[taskId] || [];
      // Don't add duplicate
      if (existing.some(m => m.displayName === displayName)) {
        return state;
      }

      return {
        mentionsByTask: {
          ...state.mentionsByTask,
          [taskId]: [
            ...existing,
            {
              type: 'lines',
              filePath,
              fileName,
              startLine,
              endLine,
              displayName,
            },
          ],
        },
      };
    });
  },

  removeMention: (taskId, displayName) => {
    set((state) => {
      const existing = state.mentionsByTask[taskId] || [];
      return {
        mentionsByTask: {
          ...state.mentionsByTask,
          [taskId]: existing.filter(m => m.displayName !== displayName),
        },
      };
    });
  },

  clearMentions: (taskId) => {
    set((state) => {
      const { [taskId]: _, ...rest } = state.mentionsByTask;
      return { mentionsByTask: rest };
    });
  },

  buildPromptWithMentions: (taskId, prompt) => {
    const mentions = get().getMentions(taskId);
    if (mentions.length === 0) {
      return { finalPrompt: prompt, displayPrompt: prompt };
    }

    // Build full path references for Claude
    const fileRefs = mentions.map(m => {
      if (m.type === 'lines') {
        const lineRange = m.startLine === m.endLine ? `L${m.startLine}` : `L${m.startLine}-${m.endLine}`;
        return `@${m.filePath}#${lineRange}`;
      }
      return `@${m.filePath}`;
    }).join(' ');

    // Build display references (short names)
    const displayRefs = mentions.map(m => m.displayName).join(' ');

    return {
      finalPrompt: `${fileRefs} ${prompt}`.trim(),
      displayPrompt: `${displayRefs} ${prompt}`.trim(),
    };
  },
}));
