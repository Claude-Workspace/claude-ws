'use client';

import { useCallback } from 'react';
import { useTaskStore } from '@/stores/task-store';
import { useContextMentionStore } from '@/stores/context-mention-store';
import { useProjectStore } from '@/stores/project-store';

interface UseFileTabAttachToChatOptions {
  filePath: string;
  activeProjectPath: string | null | undefined;
  selection: { startLine: number; endLine: number } | null;
  /** Translation fn for sidebar namespace */
  tSidebar: (key: string) => string;
  /** Translation fn for editor namespace */
  t: (key: string) => string;
}

/**
 * useFileTabAttachToChat - Handles attaching the current file or a line selection
 * to an existing or new chat task via the context mention system.
 * Extracted from use-file-tab-state to keep it under 200 lines.
 */
export function useFileTabAttachToChat({
  filePath,
  activeProjectPath,
  selection,
  tSidebar,
  t,
}: UseFileTabAttachToChatOptions) {
  const { selectedTask, createTask, selectTask } = useTaskStore();
  const { addFileMention, addLineMention } = useContextMentionStore();
  const { selectedProjectIds } = useProjectStore();

  const handleAttachToChat = useCallback(async (createNew = false) => {
    if (!activeProjectPath) return;

    try {
      let targetTask = selectedTask;

      if (createNew || !targetTask) {
        const projectId = selectedProjectIds[0];
        if (!projectId) {
          alert(tSidebar('selectProject'));
          return;
        }

        const name = filePath.split('/').pop() || filePath;
        const newTask = await createTask(projectId, `Edit ${name}`, `I want to work on ${filePath}`);
        targetTask = newTask;
      }

      const name = filePath.split('/').pop() || filePath;

      if (selection) {
        addLineMention(targetTask.id, name, filePath, selection.startLine, selection.endLine);
      } else {
        addFileMention(targetTask.id, name, filePath);
      }

      if (targetTask.id !== selectedTask?.id) {
        selectTask(targetTask.id);
      }
    } catch (error) {
      console.error('Failed to attach file:', error);
      alert(error instanceof Error ? error.message : t('addFileToChat'));
    }
  }, [
    filePath,
    activeProjectPath,
    selection,
    selectedTask,
    selectedProjectIds,
    createTask,
    selectTask,
    addFileMention,
    addLineMention,
    tSidebar,
    t,
  ]);

  return { handleAttachToChat, selectedTask };
}
