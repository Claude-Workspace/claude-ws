'use client';

import { useEffect, useMemo } from 'react';
import { useFloatingWindowsStore } from '@/stores/floating-windows-store';
import { useTaskStore } from '@/stores/task-store';
import { useIsMobileViewport } from '@/hooks/use-mobile-viewport';
import { FloatingChatWindow } from './floating-chat-window';
import { cn } from '@/lib/utils';

/**
 * Container component that renders all open floating chat windows.
 * Each window is independent and tied to a specific task.
 *
 * On mobile: renders a full-screen overlay with a tab bar for switching
 * between multiple open chats. Only the active (highest z-index) chat
 * is rendered at a time.
 *
 * On desktop: renders all windows independently as floating elements.
 */
export function FloatingChatWindowsContainer() {
  const { windows, closeWindow, bringToFront, getWindowZIndex, getOpenWindowIds } = useFloatingWindowsStore();
  const { tasks, setSelectedTask, setSelectedTaskId } = useTaskStore();
  const isMobile = useIsMobileViewport();

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

  // Mobile: full-screen overlay with tab bar
  if (isMobile) {
    // Find the active window (highest z-index)
    const activeWindow = openWindows.reduce((highest, w) =>
      getWindowZIndex(w.id) > getWindowZIndex(highest.id) ? w : highest
    );
    const activeTask = tasks.find(t => t.id === activeWindow.id);

    if (!activeTask) return null;

    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background">
        {/* Tab bar - only show when multiple windows */}
        {openWindows.length > 1 && (
          <div className="flex-shrink-0 border-b bg-muted/30 px-2 py-1.5 overflow-x-auto">
            <div className="flex gap-1.5 min-w-min">
              {openWindows.map((w) => {
                const task = tasks.find(t => t.id === w.id);
                if (!task) return null;
                const isActive = w.id === activeWindow.id;

                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      bringToFront(w.id);
                      setSelectedTaskId(w.id);
                    }}
                    className={cn(
                      'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium truncate max-w-[160px] transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {task.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active chat - fills remaining space */}
        <div className="flex-1 min-h-0 flex flex-col">
          <FloatingChatWindow
            key={activeWindow.id}
            task={activeTask}
            zIndex={getWindowZIndex(activeWindow.id)}
            onClose={() => closeWindow(activeWindow.id)}
            onMaximize={() => {
              closeWindow(activeWindow.id);
              setSelectedTask(activeTask);
            }}
            onFocus={() => {
              bringToFront(activeWindow.id);
              setSelectedTaskId(activeTask.id);
            }}
          />
        </div>
      </div>
    );
  }

  // Desktop: render all windows independently
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
