'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { Task, TaskStatus, KANBAN_COLUMNS } from '@/types';
import { Column } from './column';
import { BoardColumnVisibilityFilter } from '@/components/kanban/board-column-visibility-filter';
import { BoardDragOverlay } from '@/components/kanban/board-drag-overlay';
import { BoardMobileColumnSwipeView } from '@/components/kanban/board-mobile-column-swipe-view';
import { useTaskStore } from '@/stores/task-store';
import { usePanelLayoutStore } from '@/stores/panel-layout-store';
import { useTouchDetection } from '@/hooks/use-touch-detection';
import { useIsMobileViewport } from '@/hooks/use-mobile-viewport';
import { useChatHistorySearch } from '@/hooks/use-chat-history-search';
import { useBoardDragAndDropHandlers } from '@/components/kanban/use-board-drag-and-drop-handlers';

interface BoardProps {
  attempts?: Array<{ taskId: string; id: string }>;
  onCreateTask?: () => void;
  searchQuery?: string;
}

export function Board({ attempts = [], onCreateTask, searchQuery = '' }: BoardProps) {
  const t = useTranslations('kanban');
  const { tasks, selectTask, setPendingAutoStartTask } = useTaskStore();
  const [mobileActiveColumn, setMobileActiveColumn] = useState<TaskStatus>('in_progress');
  const [pendingNewTaskStart, setPendingNewTaskStart] = useState<{ taskId: string; description: string } | null>(null);
  const isMobile = useTouchDetection();
  const isMobileViewport = useIsMobileViewport();

  const { hiddenColumns, toggleColumn } = usePanelLayoutStore();

  const visibleColumns = useMemo(
    () => KANBAN_COLUMNS.filter((col) => !hiddenColumns.includes(col.id)),
    [hiddenColumns]
  );

  // If mobile active column is hidden, reset to first visible column
  useEffect(() => {
    if (visibleColumns.length > 0 && !visibleColumns.some((c) => c.id === mobileActiveColumn)) {
      setMobileActiveColumn(visibleColumns[0].id);
    }
  }, [visibleColumns, mobileActiveColumn]);

  // Search chat history for matches
  const { matches: chatHistoryMatches } = useChatHistorySearch(searchQuery);

  // Filter tasks based on search query (title/description) OR chat history matches
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;

    const query = searchQuery.toLowerCase();
    return tasks.filter((task) => {
      const title = task.title?.toLowerCase() || '';
      const description = task.description?.toLowerCase() || '';
      const matchesTitleOrDesc = title.includes(query) || description.includes(query);
      const hasChatMatch = chatHistoryMatches.has(task.id);
      return matchesTitleOrDesc || hasChatMatch;
    });
  }, [tasks, searchQuery, chatHistoryMatches]);

  // Handle auto-start for newly created tasks moved to In Progress
  useEffect(() => {
    if (pendingNewTaskStart) {
      const { taskId, description } = pendingNewTaskStart;
      selectTask(taskId);
      setPendingAutoStartTask(taskId, description);
      setPendingNewTaskStart(null);
    }
  }, [pendingNewTaskStart, selectTask, setPendingAutoStartTask]);

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
    grouped.forEach((colTasks) => {
      colTasks.sort((a, b) => a.position - b.position);
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

  const { activeTask, hoveredStatusTab, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel } =
    useBoardDragAndDropHandlers({
      tasks,
      tasksByStatus,
      onNewTaskAutoStart: (taskId, description) => setPendingNewTaskStart({ taskId, description }),
    });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 25,
      },
    })
  );

  // Mobile: single column view with tab bar and swipe gestures
  if (isMobileViewport) {
    return (
      <BoardMobileColumnSwipeView
        sensors={sensors}
        visibleColumns={visibleColumns}
        tasksByStatus={tasksByStatus}
        attemptCounts={attemptCounts}
        mobileActiveColumn={mobileActiveColumn}
        hoveredStatusTab={hoveredStatusTab}
        activeTask={activeTask}
        isMobile={isMobile}
        searchQuery={searchQuery}
        chatHistoryMatches={chatHistoryMatches}
        onCreateTask={onCreateTask}
        onMobileActiveColumnChange={setMobileActiveColumn}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      />
    );
  }

  // Desktop: horizontal scrolling columns
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
        <BoardColumnVisibilityFilter hiddenColumns={hiddenColumns} onToggleColumn={toggleColumn} />
        <div className="flex gap-4 flex-1 min-h-0 overflow-x-auto pb-4 pl-4">
          {visibleColumns.map((column) => (
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
      </div>

      <BoardDragOverlay
        activeTask={activeTask}
        attemptCount={attemptCounts.get(activeTask?.id ?? '') || 0}
        isMobile={isMobile}
      />
    </DndContext>
  );
}
