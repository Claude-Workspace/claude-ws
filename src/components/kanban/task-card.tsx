'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import { useTaskStore } from '@/stores/task-store';

interface TaskCardProps {
  task: Task;
  attemptCount?: number;
}

export function TaskCard({ task, attemptCount = 0 }: TaskCardProps) {
  const { selectedTaskId, selectTask } = useTaskStore();
  const isSelected = selectedTaskId === task.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group cursor-pointer touch-none',
        isDragging && 'opacity-50'
      )}
      onClick={() => selectTask(task.id)}
    >
      <Card
        className={cn(
          'p-3 transition-all hover:shadow-md',
          isSelected && 'ring-2 ring-blue-500 ring-offset-2',
          isDragging && 'cursor-grabbing'
        )}
      >
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none p-1 -ml-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Drag handle"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {task.title}
            </h3>

            {task.description && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                {task.description}
              </p>
            )}

            {attemptCount > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {attemptCount} {attemptCount === 1 ? 'attempt' : 'attempts'}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
