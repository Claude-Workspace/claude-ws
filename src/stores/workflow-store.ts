import { create } from 'zustand';
import type { SubagentNode, AgentMessage, WorkflowSummary } from '@/lib/workflow-tracker';

export interface WorkflowEntry {
  attemptId: string;
  taskId: string;
  taskTitle: string;
  nodes: SubagentNode[];
  messages: AgentMessage[];
  summary: WorkflowSummary;
}

interface WorkflowStore {
  isOpen: boolean;
  workflows: Map<string, WorkflowEntry>;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  updateWorkflow: (attemptId: string, data: Partial<WorkflowEntry>) => void;
  removeWorkflow: (attemptId: string) => void;
  getActiveAgentCount: () => number;
  getByTaskId: (taskId: string) => WorkflowEntry | undefined;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  isOpen: false,
  workflows: new Map<string, WorkflowEntry>(),

  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),

  updateWorkflow: (attemptId, data) => {
    set((state) => {
      const newMap = new Map(state.workflows);
      const existing = newMap.get(attemptId);
      newMap.set(attemptId, {
        attemptId,
        taskId: data.taskId || existing?.taskId || '',
        taskTitle: data.taskTitle || existing?.taskTitle || '',
        nodes: data.nodes || existing?.nodes || [],
        messages: data.messages || existing?.messages || [],
        summary: data.summary || existing?.summary || { chain: [], completedCount: 0, activeCount: 0, totalCount: 0 },
      });
      return { workflows: newMap };
    });
  },

  removeWorkflow: (attemptId) => {
    set((state) => {
      const newMap = new Map(state.workflows);
      newMap.delete(attemptId);
      return { workflows: newMap };
    });
  },

  getActiveAgentCount: () => {
    let count = 0;
    for (const entry of get().workflows.values()) {
      count += entry.summary.activeCount;
    }
    return count;
  },

  getByTaskId: (taskId) => {
    for (const entry of get().workflows.values()) {
      if (entry.taskId === taskId) return entry;
    }
    return undefined;
  },
}));
