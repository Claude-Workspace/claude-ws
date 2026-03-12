'use client';

import { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Task, TaskStatus, KANBAN_COLUMNS } from '@/types';
import { Column } from './column';
import { MobileStatusTab } from '@/components/kanban/board-mobile-status-tabs';
import { BoardDragOverlay } from '@/components/kanban/board-drag-overlay';
import { useTaskStore } from '@/stores/task-store';
import { leftEdgeCollisionDetector } from '@/components/kanban/board-collision-detector';
import { useBoardMobileSwipeGesture } from '@/components/kanban/use-board-mobile-swipe-gesture';
import { cn } from '@/lib/utils';

interface BoardMobileColumnSwipeViewProps {
  sensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
  visibleColumns: typeof KANBAN_COLUMNS;
  tasksByStatus: Map<TaskStatus, Task[]>;
  attemptCounts: Map<string, number>;
  mobileActiveColumn: TaskStatus;
  hoveredStatusTab: TaskStatus | null;
  activeTask: Task | null;
  isMobile: boolean;
  searchQuery: string;
  chatHistoryMatches: Set<string>;
  onCreateTask?: () => void;
  onMobileActiveColumnChange: (column: TaskStatus) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
}

/**
 * Mobile-specific kanban board view with swipeable single-column display and tab navigation.
 * Renders a tab bar for column switching, handles swipe gestures for column transitions,
 * and shows floating action buttons for task creation and bulk deletion.
 */
export function BoardMobileColumnSwipeView({
  sensors,
  visibleColumns,
  tasksByStatus,
  attemptCounts,
  mobileActiveColumn,
  hoveredStatusTab,
  activeTask,
  isMobile,
  searchQuery,
  chatHistoryMatches,
  onCreateTask,
  onMobileActiveColumnChange,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
}: BoardMobileColumnSwipeViewProps) {
  const t = useTranslations('kanban');
  const tCommon = useTranslations('common');

  const visibleColumnIds = visibleColumns.map((c) => c.id);

  const {
    swipeOffset,
    isDragging,
    isResetting,
    animatingColumn,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useBoardMobileSwipeGesture({
    visibleColumnIds,
    mobileActiveColumn,
    onColumnChange: onMobileActiveColumnChange,
  });

  const activeColumnTasks = tasksByStatus.get(mobileActiveColumn) || [];
  const currentIndex = visibleColumnIds.indexOf(mobileActiveColumn);

  // Determine which adjacent column to show based on swipe direction
  const swipingLeft = swipeOffset < 0;
  const swipingRight = swipeOffset > 0;
  const nextColumnId =
    (swipingLeft || animatingColumn === visibleColumnIds[currentIndex + 1]) &&
    currentIndex < visibleColumnIds.length - 1
      ? visibleColumnIds[currentIndex + 1]
      : null;
  const prevColumnId =
    (swipingRight || animatingColumn === visibleColumnIds[currentIndex - 1]) && currentIndex > 0
      ? visibleColumnIds[currentIndex - 1]
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
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex flex-col h-full">
        {/* Column tab bar */}
        <div className="flex-shrink-0 border-b overflow-x-auto">
          <div className="flex min-w-min">
            {visibleColumns.map((column) => {
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
                  onClick={() => onMobileActiveColumnChange(column.id)}
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
                'absolute inset-0 transition-transform duration-300 ease-out',
                (isDragging || isResetting) && 'transition-none'
              )}
              style={{ transform: `translateX(${swipeOffset}px)` }}
            >
              <Column
                key={mobileActiveColumn}
                status={mobileActiveColumn}
                title={t(KANBAN_COLUMNS.find((c) => c.id === mobileActiveColumn)!.titleKey)}
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
                  'absolute inset-0 transition-transform duration-300 ease-out',
                  (isDragging || isResetting) && 'transition-none'
                )}
                style={{
                  transform: `translateX(${swipeOffset + window.innerWidth}px)`,
                }}
              >
                <Column
                  key={nextColumnId}
                  status={nextColumnId}
                  title={t(KANBAN_COLUMNS.find((c) => c.id === nextColumnId)!.titleKey)}
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
                  'absolute inset-0 transition-transform duration-300 ease-out',
                  (isDragging || isResetting) && 'transition-none'
                )}
                style={{
                  transform: `translateX(${swipeOffset - window.innerWidth}px)`,
                }}
              >
                <Column
                  key={prevColumnId}
                  status={prevColumnId}
                  title={t(KANBAN_COLUMNS.find((c) => c.id === prevColumnId)!.titleKey)}
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
            {(mobileActiveColumn === 'done' || mobileActiveColumn === 'cancelled') &&
              activeColumnTasks.length > 0 && (
                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        t('deleteAllTasks', {
                          count: activeColumnTasks.length,
                          status: t(KANBAN_COLUMNS.find((c) => c.id === mobileActiveColumn)!.titleKey),
                        })
                      )
                    )
                      return;
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

      <BoardDragOverlay
        activeTask={activeTask}
        attemptCount={attemptCounts.get(activeTask?.id ?? '') || 0}
        isMobile={isMobile}
      />
    </DndContext>
  );
}
