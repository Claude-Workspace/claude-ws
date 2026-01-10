'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, TaskStatus, KANBAN_COLUMNS } from '@/types';
import { Column } from './column';
import { TaskCard } from './task-card';
import { useTaskStore } from '@/stores/task-store';

interface BoardProps {
  attempts?: Array<{ taskId: string; id: string }>;
}

export function Board({ attempts = [] }: BoardProps) {
  const { tasks, reorderTasks } = useTaskStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped = new Map<TaskStatus, Task[]>();
    KANBAN_COLUMNS.forEach((col) => {
      grouped.set(col.id, []);
    });

    tasks.forEach((task) => {
      const statusTasks = grouped.get(task.status) || [];
      statusTasks.push(task);
      grouped.set(task.status, statusTasks);
    });

    // Sort by position
    grouped.forEach((tasks) => {
      tasks.sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [tasks]);

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
      // Moving to a different column
      if (activeTask.status !== overColumn.id) {
        const targetTasks = tasksByStatus.get(overColumn.id) || [];
        reorderTasks(activeTask.id, overColumn.id, targetTasks.length);
      }
    } else {
      // Dropping over another task
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask && activeTask.status === overTask.status) {
        const columnTasks = tasksByStatus.get(overTask.status) || [];
        const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
        const newIndex = columnTasks.findIndex((t) => t.id === overId);

        if (oldIndex !== newIndex) {
          const reordered = arrayMove(columnTasks, oldIndex, newIndex);
          const newPosition = reordered.findIndex((t) => t.id === activeId);
          reorderTasks(activeTask.id, activeTask.status, newPosition);
        }
      }
    }
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

    // Check if dropping over a column
    const overColumn = KANBAN_COLUMNS.find((col) => col.id === overId);
    if (overColumn) {
      if (activeTask.status !== overColumn.id) {
        const targetTasks = tasksByStatus.get(overColumn.id) || [];
        reorderTasks(activeTask.id, overColumn.id, targetTasks.length);
      }
    } else {
      // Dropping over another task
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask && activeTask.status === overTask.status) {
        const columnTasks = tasksByStatus.get(overTask.status) || [];
        const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
        const newIndex = columnTasks.findIndex((t) => t.id === overId);

        if (oldIndex !== newIndex) {
          const reordered = arrayMove(columnTasks, oldIndex, newIndex);
          const newPosition = reordered.findIndex((t) => t.id === activeId);
          reorderTasks(activeTask.id, activeTask.status, newPosition);
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveTask(null);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((column) => (
          <Column
            key={column.id}
            status={column.id}
            title={column.title}
            tasks={tasksByStatus.get(column.id) || []}
            attemptCounts={attemptCounts}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-3">
            <TaskCard
              task={activeTask}
              attemptCount={attemptCounts.get(activeTask.id) || 0}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
