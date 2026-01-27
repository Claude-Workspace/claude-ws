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
import { Task, TaskStatus, KANBAN_COLUMNS } from '@/types';
import { Column } from './column';
import { TaskCard } from './task-card';
import { useTaskStore } from '@/stores/task-store';
import { useTouchDetection } from '@/hooks/use-touch-detection';

interface BoardProps {
  attempts?: Array<{ taskId: string; id: string }>;
  onCreateTask?: () => void;
  searchQuery?: string;
}

export function Board({ attempts = [], onCreateTask, searchQuery = '' }: BoardProps) {
  const t = useTranslations('kanban');
  const { tasks, reorderTasks, selectTask, setPendingAutoStartTask } = useTaskStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();
  const lastReorderRef = useRef<string>('');
  const [pendingNewTaskStart, setPendingNewTaskStart] = useState<{ taskId: string; description: string } | null>(null);
  const isMobile = useTouchDetection(); // Single global touch detection

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;

    const query = searchQuery.toLowerCase();
    return tasks.filter((task) => {
      const title = task.title?.toLowerCase() || '';
      const description = task.description?.toLowerCase() || '';
      return title.includes(query) || description.includes(query);
    });
  }, [tasks, searchQuery]);

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
