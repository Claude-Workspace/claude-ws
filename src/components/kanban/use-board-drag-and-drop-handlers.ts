'use client';

import { useRef, useState, useTransition } from 'react';
import { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, TaskStatus, KANBAN_COLUMNS } from '@/types';
import { useTaskStore } from '@/stores/task-store';

interface UseBoardDragAndDropHandlersProps {
  tasks: Task[];
  tasksByStatus: Map<TaskStatus, Task[]>;
  onNewTaskAutoStart?: (taskId: string, description: string) => void;
}

interface UseBoardDragAndDropHandlersReturn {
  activeTask: Task | null;
  hoveredStatusTab: TaskStatus | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

/**
 * Hook encapsulating all drag-and-drop event handlers for the kanban board.
 * Manages active task state, hovered status tab tracking, and orchestrates
 * task reordering across columns on drag end.
 */
export function useBoardDragAndDropHandlers({
  tasks,
  tasksByStatus,
  onNewTaskAutoStart,
}: UseBoardDragAndDropHandlersProps): UseBoardDragAndDropHandlersReturn {
  const { reorderTasks } = useTaskStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [hoveredStatusTab, setHoveredStatusTab] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();
  const lastReorderRef = useRef<string>('');

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

    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    // Check if dropping over a column - actual reorder handled in handleDragEnd
    const overColumn = KANBAN_COLUMNS.find((col) => col.id === overId);
    if (overColumn) return;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setHoveredStatusTab(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    // Skip if we just processed this exact same reorder
    if (lastReorderRef.current === `${activeId}-${overId}`) {
      return;
    }

    // Mark this reorder as in-progress
    lastReorderRef.current = `${activeId}-${overId}`;

    // Check if this is a newly created task moving to In Progress
    const isNewTaskToInProgress = !draggedTask.chatInit && draggedTask.status === 'todo';

    // Wrap in startTransition to avoid blocking the UI during reordering
    startTransition(async () => {
      // Check if dropping over a status tab (mobile)
      if (typeof overId === 'string' && overId.startsWith('status-tab-')) {
        const targetStatus = overId.replace('status-tab-', '') as TaskStatus;
        if (draggedTask.status !== targetStatus) {
          const targetTasks = tasksByStatus.get(targetStatus) || [];
          await reorderTasks(draggedTask.id, targetStatus, targetTasks.length);

          if (isNewTaskToInProgress && targetStatus === 'in_progress' && draggedTask.description) {
            onNewTaskAutoStart?.(draggedTask.id, draggedTask.description);
          }
        }
      } else {
        // Check if dropping over a column (desktop)
        const overColumn = KANBAN_COLUMNS.find((col) => col.id === overId);
        if (overColumn) {
          if (draggedTask.status !== overColumn.id) {
            const targetTasks = tasksByStatus.get(overColumn.id) || [];
            await reorderTasks(draggedTask.id, overColumn.id, targetTasks.length);

            if (isNewTaskToInProgress && overColumn.id === 'in_progress' && draggedTask.description) {
              onNewTaskAutoStart?.(draggedTask.id, draggedTask.description);
            }
          }
        } else {
          // Dropping over another task
          const overTask = tasks.find((t) => t.id === overId);
          if (overTask) {
            const targetColumn = overTask.status;
            const columnTasks = tasksByStatus.get(targetColumn) || [];

            const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
            const newIndex = columnTasks.findIndex((t) => t.id === overId);

            if (draggedTask.status !== targetColumn || oldIndex !== newIndex) {
              if (draggedTask.status !== targetColumn) {
                // Moving to different column - place at the position of overTask
                await reorderTasks(draggedTask.id, targetColumn, newIndex);

                if (isNewTaskToInProgress && targetColumn === 'in_progress' && draggedTask.description) {
                  onNewTaskAutoStart?.(draggedTask.id, draggedTask.description);
                }
              } else if (oldIndex !== -1 && newIndex !== -1) {
                // Reordering within same column
                const reordered = arrayMove(columnTasks, oldIndex, newIndex);
                const newPosition = reordered.findIndex((t) => t.id === activeId);
                await reorderTasks(draggedTask.id, draggedTask.status, newPosition);
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

  return {
    activeTask,
    hoveredStatusTab,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
