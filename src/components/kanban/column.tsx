'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Task, TaskStatus } from '@/types';
import { TaskCard } from './task-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  attemptCounts?: Map<string, number>;
  onCreateTask?: () => void;
}

export function Column({ status, title, tasks, attemptCounts = new Map(), onCreateTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'column',
      status,
    },
  });

  const taskIds = tasks.map((task) => task.id);
  const isTodoColumn = status === 'todo';

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
              title="New task"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-lg bg-muted/50 p-2 transition-colors border border-border/50',
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
