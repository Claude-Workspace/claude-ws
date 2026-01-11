'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GripVertical, MessageSquare } from 'lucide-react';
import { useTaskStore } from '@/stores/task-store';
import { useProjectStore } from '@/stores/project-store';

interface TaskCardProps {
  task: Task;
  attemptCount?: number;
}

export function TaskCard({ task, attemptCount = 0 }: TaskCardProps) {
  const { selectedTaskId, selectTask } = useTaskStore();
  const { projects, selectedProjectIds, isAllProjectsMode } = useProjectStore();
  const isSelected = selectedTaskId === task.id;

  // Show project badge when viewing multiple projects
  const showProjectBadge = isAllProjectsMode() || selectedProjectIds.length > 1;
  const projectName = projects.find(p => p.id === task.projectId)?.name;

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
      <div
        className={cn(
          'relative bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800',
          'p-3 transition-all duration-200',
          'hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm',
          isSelected && 'ring-2 ring-primary ring-offset-1 border-primary',
          isDragging && 'cursor-grabbing shadow-lg'
        )}
      >
        {/* Drag handle - visible on hover */}
        <button
          {...attributes}
          {...listeners}
          className={cn(
            'absolute left-1 top-1/2 -translate-y-1/2 cursor-grab touch-none p-1 rounded',
            'text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800'
          )}
          aria-label="Drag handle"
        >
          <GripVertical className="size-3.5" />
        </button>

        <div className="pl-5">
          {/* Header: Project badge */}
          {showProjectBadge && projectName && (
            <div className="mb-2">
              <span className="inline-flex items-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                {projectName}
              </span>
            </div>
          )}

          {/* Title */}
          <h3 className="font-semibold text-[13px] leading-snug text-zinc-900 dark:text-zinc-100 line-clamp-2">
            {task.title}
          </h3>

          {/* Description */}
          {task.description && (
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Footer: Metadata */}
          {attemptCount > 0 && (
            <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                <MessageSquare className="size-3" />
                <span>{attemptCount}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
