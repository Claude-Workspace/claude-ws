'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Trash2 } from 'lucide-react';
import { Task, TaskStatus } from '@/types';
import { TaskCard } from './task-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/stores/task-store';

interface ColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  attemptCounts?: Map<string, number>;
  onCreateTask?: () => void;
  searchQuery?: string;
}

export function Column({ status, title, tasks, attemptCounts = new Map(), onCreateTask, searchQuery = '' }: ColumnProps) {
  const { deleteTasksByStatus } = useTaskStore();
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'column',
      status,
    },
  });

  const taskIds = tasks.map((task) => task.id);
  const isTodoColumn = status === 'todo';
  const isArchiveColumn = status === 'done' || status === 'cancelled';

  const handleEmptyColumn = async () => {
    if (tasks.length === 0) return;
    if (!confirm(`Delete all ${tasks.length} task(s) from ${title}?`)) return;
    try {
      await deleteTasksByStatus(status);
    } catch (error) {
      console.error('Failed to empty column:', error);
    }
  };

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[320px]">
      <div className="flex items-center justify-between px-3 py-2 mb-3">
        <h2 className="font-semibold text-sm text-foreground/80">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {tasks.length}
          </span>
          {isTodoColumn && onCreateTask && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onCreateTask}
              title="New Task (Ctrl/⌘ + Space)"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {isArchiveColumn && tasks.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={handleEmptyColumn}
              title={`Delete all ${tasks.length} task(s)`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-lg bg-muted/50 p-2 transition-colors border border-border/50 overflow-y-auto min-h-0 kanban-scrollbar',
          isOver && 'bg-accent/50 border-accent'
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                attemptCount={attemptCounts.get(task.id) || 0}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
