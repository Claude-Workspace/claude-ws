'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Task, TaskStatus, KANBAN_COLUMNS } from '@/types';
import { Column } from './column';
import { TaskCard } from './task-card';
import { useTaskStore } from '@/stores/task-store';
import { useTouchDetection } from '@/hooks/use-touch-detection';
import { useIsMobileViewport } from '@/hooks/use-mobile-viewport';
import { useChatHistorySearch } from '@/hooks/use-chat-history-search';
import { cn } from '@/lib/utils';

interface BoardProps {
  attempts?: Array<{ taskId: string; id: string }>;
  onCreateTask?: () => void;
  searchQuery?: string;
}

export function Board({ attempts = [], onCreateTask, searchQuery = '' }: BoardProps) {
  const t = useTranslations('kanban');
  const tCommon = useTranslations('common');
  const { tasks, reorderTasks, selectTask, setPendingAutoStartTask } = useTaskStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();
  const lastReorderRef = useRef<string>('');
  const [pendingNewTaskStart, setPendingNewTaskStart] = useState<{ taskId: string; description: string } | null>(null);
  const [mobileActiveColumn, setMobileActiveColumn] = useState<TaskStatus>('in_progress');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isMobile = useTouchDetection(); // Single global touch detection
  const isMobileViewport = useIsMobileViewport();

  // Search chat history for matches
  const { matches: chatHistoryMatches } = useChatHistorySearch(searchQuery);

  // Filter tasks based on search query (title/description) OR chat history matches
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;

    const query = searchQuery.toLowerCase();
    return tasks.filter((task) => {
      // Check title and description
      const title = task.title?.toLowerCase() || '';
      const description = task.description?.toLowerCase() || '';
      const matchesTitleOrDesc = title.includes(query) || description.includes(query);

      // Check if task has a chat history match
      const hasChatMatch = chatHistoryMatches.has(task.id);

      return matchesTitleOrDesc || hasChatMatch;
    });
  }, [tasks, searchQuery, chatHistoryMatches]);

  // Handle auto-start for newly created tasks moved to In Progress
  useEffect(() => {
    if (pendingNewTaskStart) {
      const { taskId, description } = pendingNewTaskStart;
      // Select the task and trigger auto-start
      selectTask(taskId);
      setPendingAutoStartTask(taskId, description);
      setPendingNewTaskStart(null);
    }
  }, [pendingNewTaskStart, selectTask, setPendingAutoStartTask]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 120, // Faster activation
        tolerance: 25, // Higher tolerance for Samsung S25 touch handling
      },
    })
  );

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped = new Map<TaskStatus, Task[]>();
    KANBAN_COLUMNS.forEach((col) => {
      grouped.set(col.id, []);
    });

    filteredTasks.forEach((task) => {
      const statusTasks = grouped.get(task.status) || [];
      statusTasks.push(task);
      grouped.set(task.status, statusTasks);
    });

    // Sort by position
    grouped.forEach((tasks) => {
      tasks.sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [filteredTasks]);

  // Count attempts per task
  const attemptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    attempts.forEach((attempt) => {
      counts.set(attempt.taskId, (counts.get(attempt.taskId) || 0) + 1);
    });
    return counts;
  }, [attempts]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Check if dropping over a column
    const overColumn = KANBAN_COLUMNS.find((col) => col.id === overId);
    if (overColumn) {
      // Moving to a different column - don't reorder during drag, just for visual
      // The actual reorder happens in handleDragEnd
      return;
    }
    // Don't do anything during dragOver - let handleDragEnd handle the reordering
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Skip if we just processed this exact same reorder
    if (lastReorderRef.current === `${activeId}-${overId}`) {
      return;
    }

    // Mark this reorder as in-progress
    lastReorderRef.current = `${activeId}-${overId}`;

    // Check if this is a newly created task moving to In Progress
    const isNewTaskToInProgress = !activeTask.chatInit && activeTask.status === 'todo';

    // Wrap in startTransition to avoid blocking the UI during reordering
    startTransition(async () => {
      // Check if dropping over a column
      const overColumn = KANBAN_COLUMNS.find((col) => col.id === overId);
      if (overColumn) {
        if (activeTask.status !== overColumn.id) {
          const targetTasks = tasksByStatus.get(overColumn.id) || [];
          await reorderTasks(activeTask.id, overColumn.id, targetTasks.length);

          // If this is a newly created task moving to In Progress, trigger auto-start
          if (isNewTaskToInProgress && overColumn.id === 'in_progress' && activeTask.description) {
            setPendingNewTaskStart({ taskId: activeTask.id, description: activeTask.description });
          }
        }
      } else {
        // Dropping over another task
        const overTask = tasks.find((t) => t.id === overId);
        if (overTask) {
          const targetColumn = overTask.status;
          const columnTasks = tasksByStatus.get(targetColumn) || [];

          // Find current position in the active task's current column
          const oldIndex = columnTasks.findIndex((t) => t.id === activeId);

          // Find position in target column
          const newIndex = columnTasks.findIndex((t) => t.id === overId);

          // If moving to different column or reordering within same column
          if (activeTask.status !== targetColumn || oldIndex !== newIndex) {
            // Handle the move in the target column
            if (activeTask.status !== targetColumn) {
              // Moving to different column - place at the position of overTask
              await reorderTasks(activeTask.id, targetColumn, newIndex);

              // If this is a newly created task moving to In Progress, trigger auto-start
              if (isNewTaskToInProgress && targetColumn === 'in_progress' && activeTask.description) {
                setPendingNewTaskStart({ taskId: activeTask.id, description: activeTask.description });
              }
            } else if (oldIndex !== -1 && newIndex !== -1) {
              // Reordering within same column
              const reordered = arrayMove(columnTasks, oldIndex, newIndex);
              const newPosition = reordered.findIndex((t) => t.id === activeId);
              await reorderTasks(activeTask.id, activeTask.status, newPosition);
            }
          }
        }
      }

      // Reset the ref after a short delay to allow for rapid reordering of different tasks
      setTimeout(() => {
        lastReorderRef.current = '';
      }, 100);
    });
  };

  const handleDragCancel = () => {
    setActiveTask(null);
  };

  // Mobile swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;

    const columnIds = KANBAN_COLUMNS.map(c => c.id);
    const currentIndex = columnIds.indexOf(mobileActiveColumn);

    if (dx < 0 && currentIndex < columnIds.length - 1) {
      setMobileActiveColumn(columnIds[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      setMobileActiveColumn(columnIds[currentIndex - 1]);
    }
  };

  // Mobile: single column view with tab bar
  if (isMobileViewport) {
    const activeColumnTasks = tasksByStatus.get(mobileActiveColumn) || [];

    return (
      <DndContext
        sensors={sensors}
        autoScroll={{
          acceleration: 10,
          interval: 5,
          threshold: { x: 0.2, y: 0.2 },
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-col h-full">
          {/* Column tab bar */}
          <div className="flex-shrink-0 border-b overflow-x-auto">
            <div className="flex min-w-min">
              {KANBAN_COLUMNS.map((column) => {
                const count = (tasksByStatus.get(column.id) || []).length;
                const isActive = column.id === mobileActiveColumn;

                return (
                  <button
                    key={column.id}
                    onClick={() => setMobileActiveColumn(column.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2',
                      isActive
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t(column.titleKey)}
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active column - full width, swipeable */}
          <div className="flex-1 min-h-0 relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <Column
              key={mobileActiveColumn}
              status={mobileActiveColumn}
              title={t(KANBAN_COLUMNS.find(c => c.id === mobileActiveColumn)!.titleKey)}
              tasks={activeColumnTasks}
              attemptCounts={attemptCounts}
              onCreateTask={onCreateTask}
              searchQuery={searchQuery}
              isMobile={isMobile}
              chatHistoryMatches={chatHistoryMatches}
              fullWidth
              hideHeader
            />

            {/* Fixed Delete All button for Done/Cancelled columns */}
            {(mobileActiveColumn === 'done' || mobileActiveColumn === 'cancelled') && activeColumnTasks.length > 0 && (
              <button
                onClick={async () => {
                  if (!confirm(t('deleteAllTasks', { count: activeColumnTasks.length }))) return;
                  try {
                    await useTaskStore.getState().deleteTasksByStatus(mobileActiveColumn);
                  } catch (error) {
                    console.error('Failed to empty column:', error);
                  }
                }}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-medium rounded-lg shadow-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {tCommon('delete')} All
              </button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="rotate-3">
              <TaskCard
                task={activeTask}
                attemptCount={attemptCounts.get(activeTask.id) || 0}
                isMobile={isMobile}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  // Desktop: horizontal scrolling columns
  return (
    <DndContext
      sensors={sensors}
      autoScroll={{
        acceleration: 10, // Default speed
        interval: 5, // Default interval - faster updates
        threshold: {
          x: 0.2, // Default threshold
          y: 0.2,
        },
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4 pl-4">
        {KANBAN_COLUMNS.map((column) => (
          <Column
            key={column.id}
            status={column.id}
            title={t(column.titleKey)}
            tasks={tasksByStatus.get(column.id) || []}
            attemptCounts={attemptCounts}
            onCreateTask={onCreateTask}
            searchQuery={searchQuery}
            isMobile={isMobile}
            chatHistoryMatches={chatHistoryMatches}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-3">
            <TaskCard
              task={activeTask}
              attemptCount={attemptCounts.get(activeTask.id) || 0}
              isMobile={isMobile}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
