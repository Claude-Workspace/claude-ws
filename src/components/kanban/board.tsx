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
  useDroppable,
  CollisionDetection,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, ArrowDown } from 'lucide-react';
import { Task, TaskStatus, KANBAN_COLUMNS } from '@/types';
import { Column } from './column';
import { TaskCard } from './task-card';
import { useTaskStore } from '@/stores/task-store';
import { useTouchDetection } from '@/hooks/use-touch-detection';
import { useIsMobileViewport } from '@/hooks/use-mobile-viewport';
import { useChatHistorySearch } from '@/hooks/use-chat-history-search';
import { cn } from '@/lib/utils';

/**
 * Custom collision detector for mobile status tabs.
 * Triggers when ANY point along the left edge (top-left to bottom-left) of the dragging element
 * reaches the droppable area. This provides a larger hit area and more intuitive drag experience
 * on mobile where users want to see the drop target activate as soon as the leading edge touches it.
 */
const leftEdgeCollisionDetector: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableContainers, active } = args;

  if (!pointerCoordinates || !active) {
    return [];
  }

  // Get the dragging rectangle (the active node's current transformed position)
  const activeRect = active.rect.current.translated;
  if (!activeRect) {
    return [];
  }

  // Get left edge coordinates and height of the dragging element
  const leftX = activeRect.left;
  const topY = activeRect.top;
  const bottomY = activeRect.bottom;

  const collisions: Array<{ id: string | number }> = [];

  for (const container of droppableContainers) {
    const containerRect = container.rect.current;
    if (!containerRect) continue;

    // Check if ANY point along the left edge is within the container
    // This means the left edge X must be within container's horizontal bounds
    // AND the vertical ranges must overlap (any Y from topY to bottomY is within container)
    const horizontalWithin = leftX >= containerRect.left && leftX <= containerRect.right;
    const verticalOverlaps = topY <= containerRect.bottom && bottomY >= containerRect.top;

    if (horizontalWithin && verticalOverlaps) {
      collisions.push({
        id: container.id,
      });
    }
  }

  return collisions;
};

interface BoardProps {
  attempts?: Array<{ taskId: string; id: string }>;
  onCreateTask?: () => void;
  searchQuery?: string;
}

// Mobile status tab component that's droppable
interface MobileStatusTabProps {
  status: TaskStatus;
  title: string;
  count: number;
  isActive: boolean;
  isOver: boolean;
  onClick: () => void;
}

function MobileStatusTab({ status, title, count, isActive, isOver, onClick }: MobileStatusTabProps) {
  const { setNodeRef } = useDroppable({
    id: `status-tab-${status}`,
    data: {
      type: 'status-tab',
      status,
    },
  });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 overflow-hidden',
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
        isOver && 'bg-accent/50'
      )}
    >
      <span className={cn(
        'transition-opacity duration-200',
        isOver ? 'opacity-30' : ''
      )}>
        {title}
      </span>
      <span className={cn(
        'text-[10px] px-1.5 py-0.5 rounded-full transition-opacity duration-200',
        isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        isOver && 'opacity-30'
      )}>
        {count}
      </span>

      {/* Drop indicator */}
      {isOver && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
          <ArrowDown className="h-4 w-4 text-primary" />
        </div>
      )}
    </button>
  );
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
  const [hoveredStatusTab, setHoveredStatusTab] = useState<TaskStatus | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [animatingColumn, setAnimatingColumn] = useState<TaskStatus | null>(null);
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
    if (!over) {
      setHoveredStatusTab(null);
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) {
      setHoveredStatusTab(null);
      return;
    }

    // Check if hovering over a status tab (mobile)
    if (typeof overId === 'string' && overId.startsWith('status-tab-')) {
      const status = overId.replace('status-tab-', '') as TaskStatus;
      setHoveredStatusTab(status);
      return;
    }

    setHoveredStatusTab(null);

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
    setHoveredStatusTab(null);

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
      // Check if dropping over a status tab (mobile)
      if (typeof overId === 'string' && overId.startsWith('status-tab-')) {
        const targetStatus = overId.replace('status-tab-', '') as TaskStatus;
        if (activeTask.status !== targetStatus) {
          const targetTasks = tasksByStatus.get(targetStatus) || [];
          await reorderTasks(activeTask.id, targetStatus, targetTasks.length);

          // If this is a newly created task moving to In Progress, trigger auto-start
          if (isNewTaskToInProgress && targetStatus === 'in_progress' && activeTask.description) {
            setPendingNewTaskStart({ taskId: activeTask.id, description: activeTask.description });
          }
        }
      } else {
        // Check if dropping over a column (desktop)
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
      }

      // Reset the ref after a short delay to allow for rapid reordering of different tasks
      setTimeout(() => {
        lastReorderRef.current = '';
      }, 100);
    });
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    setHoveredStatusTab(null);
  };

  // Mobile swipe handlers with visual feedback
  const handleTouchStart = (e: React.TouchEvent) => {
    // Check if touch started on a drag handle - if so, don't handle swipe
    const target = e.target as HTMLElement;
    const dragHandle = target.closest('[aria-label="Drag to reorder"]');
    if (dragHandle) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwipeOffset(0);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Skip if touch started on drag handle (touchStartRef would be null)
    if (!touchStartRef.current || !isDragging) return;

    const currentX = e.touches[0].clientX;
    const dx = currentX - touchStartRef.current.x;

    // Calculate swipe offset with resistance
    // Limit the offset to simulate snap-back at edges
    const maxOffset = window.innerWidth * 0.4;
    let newOffset = dx;

    // Apply resistance beyond maxOffset
    if (Math.abs(newOffset) > maxOffset) {
      newOffset = maxOffset * Math.sign(newOffset) + (newOffset - maxOffset * Math.sign(newOffset)) * 0.3;
    }

    setSwipeOffset(newOffset);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Skip if touch started on drag handle
    if (!touchStartRef.current) {
      setIsDragging(false);
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    setIsDragging(false);

    const columnIds = KANBAN_COLUMNS.map(c => c.id);
    const currentIndex = columnIds.indexOf(mobileActiveColumn);
    const threshold = window.innerWidth * 0.2; // 20% of screen width to trigger column change

    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(dx) < threshold || Math.abs(dy) > Math.abs(dx)) {
      // Animate back to original position
      setSwipeOffset(0);
      return;
    }

    // Determine next column
    let nextColumn: TaskStatus | null = null;
    if (dx < 0 && currentIndex < columnIds.length - 1) {
      nextColumn = columnIds[currentIndex + 1];
    } else if (dx > 0 && currentIndex > 0) {
      nextColumn = columnIds[currentIndex - 1];
    }

    if (nextColumn) {
      // Set animating column to show transition
      setAnimatingColumn(nextColumn);

      // Animate fully to next column
      const screenWidth = window.innerWidth;
      const targetOffset = dx < 0 ? -screenWidth : screenWidth;
      setSwipeOffset(targetOffset);

      // After animation completes, switch column and reset offset
      setTimeout(() => {
        // Disable transition during reset to prevent flash
        setIsResetting(true);
        setMobileActiveColumn(nextColumn!);
        setSwipeOffset(0);
        setAnimatingColumn(null);

        // Re-enable transition after reset
        requestAnimationFrame(() => {
          setIsResetting(false);
        });
      }, 300);
    } else {
      // At edge, animate back
      setSwipeOffset(0);
    }
  };

  // Mobile: single column view with tab bar
  if (isMobileViewport) {
    const activeColumnTasks = tasksByStatus.get(mobileActiveColumn) || [];
    const columnIds = KANBAN_COLUMNS.map(c => c.id);
    const currentIndex = columnIds.indexOf(mobileActiveColumn);

    // Determine which adjacent column to show based on swipe direction
    const swipingLeft = swipeOffset < 0;
    const swipingRight = swipeOffset > 0;
    const nextColumnId = (swipingLeft || animatingColumn === columnIds[currentIndex + 1]) && currentIndex < columnIds.length - 1
      ? columnIds[currentIndex + 1]
      : null;
    const prevColumnId = (swipingRight || animatingColumn === columnIds[currentIndex - 1]) && currentIndex > 0
      ? columnIds[currentIndex - 1]
      : null;

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={leftEdgeCollisionDetector}
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
                const isOver = hoveredStatusTab === column.id;

                return (
                  <MobileStatusTab
                    key={column.id}
                    status={column.id}
                    title={t(column.titleKey)}
                    count={count}
                    isActive={isActive}
                    isOver={isOver}
                    onClick={() => setMobileActiveColumn(column.id)}
                  />
                );
              })}
            </div>
          </div>

          {/* Active column - full width, swipeable with visual feedback */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="h-full"
            >
              {/* Current column - moves with swipe */}
              <div
                className={cn(
                  "absolute inset-0 transition-transform duration-300 ease-out",
                  (isDragging || isResetting) && "transition-none"
                )}
                style={{ transform: `translateX(${swipeOffset}px)` }}
              >
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
              </div>

              {/* Next column - slides in from right when swiping left */}
              {nextColumnId && (
                <div
                  className={cn(
                    "absolute inset-0 transition-transform duration-300 ease-out",
                    (isDragging || isResetting) && "transition-none"
                  )}
                  style={{
                    transform: `translateX(${swipeOffset + window.innerWidth}px)`,
                  }}
                >
                  <Column
                    key={nextColumnId}
                    status={nextColumnId}
                    title={t(KANBAN_COLUMNS.find(c => c.id === nextColumnId)!.titleKey)}
                    tasks={tasksByStatus.get(nextColumnId) || []}
                    attemptCounts={attemptCounts}
                    onCreateTask={onCreateTask}
                    searchQuery={searchQuery}
                    isMobile={isMobile}
                    chatHistoryMatches={chatHistoryMatches}
                    fullWidth
                    hideHeader
                  />
                </div>
              )}

              {/* Previous column - slides in from left when swiping right */}
              {prevColumnId && (
                <div
                  className={cn(
                    "absolute inset-0 transition-transform duration-300 ease-out",
                    (isDragging || isResetting) && "transition-none"
                  )}
                  style={{
                    transform: `translateX(${swipeOffset - window.innerWidth}px)`,
                  }}
                >
                  <Column
                    key={prevColumnId}
                    status={prevColumnId}
                    title={t(KANBAN_COLUMNS.find(c => c.id === prevColumnId)!.titleKey)}
                    tasks={tasksByStatus.get(prevColumnId) || []}
                    attemptCounts={attemptCounts}
                    onCreateTask={onCreateTask}
                    searchQuery={searchQuery}
                    isMobile={isMobile}
                    chatHistoryMatches={chatHistoryMatches}
                    fullWidth
                    hideHeader
                  />
                </div>
              )}
            </div>

            {/* Mobile floating buttons - stacked bottom-right */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
              {/* Delete All - small pill above the + button, only on Done/Cancelled */}
              {(mobileActiveColumn === 'done' || mobileActiveColumn === 'cancelled') && activeColumnTasks.length > 0 && (
                <button
                  onClick={async () => {
                    if (!confirm(t('deleteAllTasks', { count: activeColumnTasks.length, status: t(KANBAN_COLUMNS.find(c => c.id === mobileActiveColumn)!.titleKey) }))) return;
                    try {
                      await useTaskStore.getState().deleteTasksByStatus(mobileActiveColumn);
                    } catch (error) {
                      console.error('Failed to empty column:', error);
                    }
                  }}
                  className="flex items-center justify-center w-10 h-10 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full shadow-lg transition-colors active:scale-95"
                  aria-label={`${tCommon('delete')} All`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {/* Add Task FAB - always visible on mobile */}
              {onCreateTask && (
                <button
                  onClick={onCreateTask}
                  className="flex items-center justify-center w-12 h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg transition-all active:scale-95"
                  aria-label={t('addNew')}
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
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
