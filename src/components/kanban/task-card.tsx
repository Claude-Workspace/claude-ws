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
        'group cursor-pointer touch-none select-none',
        isDragging && 'opacity-50'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'relative bg-card rounded-lg border border-border',
          'px-2.5 py-2.5 transition-all duration-200',
          'hover:border-border/80 hover:shadow-sm',
          'cursor-grab active:cursor-grabbing',
          isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background border-primary',
          isDragging && 'shadow-lg'
        )}
        // Prevent text selection during drag, allow tap to open
        onTouchStart={(e) => {
          // Don't prevent default here - let dnd-kit handle the long press
          // Only prevent default if we're actually dragging
        }}
        onClick={(e) => {
          // Only open detail panel if this wasn't a drag operation
          if (!isDragging) {
            selectTask(task.id);
          }
        }}
      >
        {/* Drag handle - visible on hover (desktop) */}
        <button
          className={cn(
            'absolute left-0.5 top-1/2 -translate-y-1/2 cursor-grab touch-none p-0.5 rounded',
            'text-muted-foreground/40 hover:text-muted-foreground',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-muted pointer-events-none sm:pointer-events-auto'
          )}
          aria-label="Drag handle"
        >
          <GripVertical className="size-3" />
        </button>

        <div className="pl-3.5">
          {/* Header: Project badge - smaller */}
          {showProjectBadge && projectName && (
            <div className="mb-1">
              <span className="inline-flex items-center text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                {projectName}
              </span>
            </div>
          )}

          {/* Title - larger */}
          <h3 className="font-semibold text-sm leading-snug text-card-foreground line-clamp-2">
            {task.title}
          </h3>

          {/* Description */}
          {task.description && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Footer: Metadata */}
          {attemptCount > 0 && (
            <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
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
