'use client';

import { useFloatingWindowsStore } from '@/stores/floating-windows-store';
import { useTaskStore } from '@/stores/task-store';
import { FloatingChatWindow } from './floating-chat-window';

/**
 * Container component that renders all open floating chat windows.
 * Each window is independent and tied to a specific task.
 */
export function FloatingChatWindowsContainer() {
  const { windows, closeWindow, bringToFront, getWindowZIndex } = useFloatingWindowsStore();
  const { tasks, setSelectedTask, setSelectedTaskId } = useTaskStore();

  // Convert windows map to array for rendering
  const openWindows = Array.from(windows.values()).filter(w => w.type === 'chat');

  if (openWindows.length === 0) return null;

  return (
    <>
      {openWindows.map((window) => {
        const task = tasks.find(t => t.id === window.id);
        if (!task) {
          // Task no longer exists, close the window
          closeWindow(window.id);
          return null;
        }

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
