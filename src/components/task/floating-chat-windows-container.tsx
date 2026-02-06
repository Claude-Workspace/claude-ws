'use client';

import { useEffect, useMemo } from 'react';
import { useFloatingWindowsStore } from '@/stores/floating-windows-store';
import { useTaskStore } from '@/stores/task-store';
import { FloatingChatWindow } from './floating-chat-window';

/**
 * Container component that renders all open floating chat windows.
 * Each window is independent and tied to a specific task.
 */
export function FloatingChatWindowsContainer() {
  const { windows, closeWindow, bringToFront, getWindowZIndex, getOpenWindowIds } = useFloatingWindowsStore();
  const { tasks, setSelectedTask, setSelectedTaskId } = useTaskStore();

  // Convert windows map to array for rendering
  const openWindows = useMemo(
    () => Array.from(windows.values()).filter(w => w.type === 'chat'),
    [windows]
  );

  // Clean up windows for tasks that no longer exist
  useEffect(() => {
    const taskIds = new Set(tasks.map(t => t.id));
    const windowIds = getOpenWindowIds();

    for (const windowId of windowIds) {
      const window = windows.get(windowId);
      if (window?.type === 'chat' && !taskIds.has(windowId)) {
        closeWindow(windowId);
      }
    }
  }, [tasks, windows, getOpenWindowIds, closeWindow]);

  if (openWindows.length === 0) return null;

  return (
    <>
      {openWindows.map((window) => {
        const task = tasks.find(t => t.id === window.id);
        // Only render if task still exists
        if (!task) return null;

        return (
          <FloatingChatWindow
            key={window.id}
            task={task}
            zIndex={getWindowZIndex(window.id)}
            onClose={() => closeWindow(window.id)}
            onMaximize={() => {
              // Close floating window and open in panel
              closeWindow(window.id);
              setSelectedTask(task);
            }}
            onFocus={() => {
              bringToFront(window.id);
              setSelectedTaskId(task.id);
            }}
          />
        );
      })}
    </>
  );
}
