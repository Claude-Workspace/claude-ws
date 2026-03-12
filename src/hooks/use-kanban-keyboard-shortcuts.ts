'use client';

// Registers global keyboard shortcuts for the Kanban app layout:
// Cmd+N / Cmd+Space → new task, Cmd+B → toggle sidebar,
// Cmd+` → toggle terminal, Escape → close active panel in priority order.

import { useEffect, useCallback } from 'react';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useTerminalStore } from '@/stores/terminal-store';
import type { Task } from '@/types';

interface UseKanbanKeyboardShortcutsOptions {
  selectedTask: Task | null;
  setSelectedTask: (task: Task | null) => void;
  onCreateTask: () => void;
}

export function useKanbanKeyboardShortcuts({
  selectedTask,
  setSelectedTask,
  onCreateTask,
}: UseKanbanKeyboardShortcutsOptions) {
  const toggleSidebar = useSidebarStore((s) => s.toggleSidebar);
  const isOpen = useSidebarStore((s) => s.isOpen);
  const setIsOpen = useSidebarStore((s) => s.setIsOpen);
  const openTabs = useSidebarStore((s) => s.openTabs);
  const activeTabId = useSidebarStore((s) => s.activeTabId);
  const closeTab = useSidebarStore((s) => s.closeTab);
  const diffTabs = useSidebarStore((s) => s.diffTabs);
  const activeDiffTabId = useSidebarStore((s) => s.activeDiffTabId);
  const closeDiffTab = useSidebarStore((s) => s.closeDiffTab);

  const handleCloseTab = useCallback((tabId: string, confirmMsg: (fileName: string) => string) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      const fileName = tab.filePath.split('/').pop() || tab.filePath;
      if (!confirm(confirmMsg(fileName))) return;
    }
    closeTab(tabId);
  }, [openTabs, closeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'n') { e.preventDefault(); onCreateTask(); return; }
      if (mod && e.code === 'Space') { e.preventDefault(); onCreateTask(); return; }
      if (mod && e.key === 'b') { e.preventDefault(); toggleSidebar(); return; }
      if (mod && e.key === '`') { e.preventDefault(); useTerminalStore.getState().togglePanel(); return; }

      if (e.key === 'Escape') {
        // Priority: file tab > diff tab > task detail > sidebar
        if (activeTabId && openTabs.length > 0) {
          handleCloseTab(activeTabId, (fileName) => `Unsaved changes in "${fileName}". Discard?`);
          return;
        }
        if (activeDiffTabId && diffTabs.length > 0) {
          closeDiffTab(activeDiffTabId);
          return;
        }
        if (selectedTask) { setSelectedTask(null); return; }
        if (isOpen) { setIsOpen(false); return; }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedTask, toggleSidebar, activeTabId, openTabs, handleCloseTab,
    activeDiffTabId, diffTabs, closeDiffTab, isOpen, setIsOpen, setSelectedTask, onCreateTask,
  ]);

  return { handleCloseTab };
}
