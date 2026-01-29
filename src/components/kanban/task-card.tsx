'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types';
import { cn } from '@/lib/utils';
import { GripVertical, MessageSquare, Trash2, Search } from 'lucide-react';
import { useTaskStore } from '@/stores/task-store';
import { useProjectStore } from '@/stores/project-store';
import type { ChatHistoryMatch } from '@/hooks/use-chat-history-search';

interface TaskCardProps {
  task: Task;
  attemptCount?: number;
  searchQuery?: string;
  isMobile?: boolean;
  chatHistoryMatch?: ChatHistoryMatch;
}

export function TaskCard({ task, attemptCount = 0, searchQuery = '', isMobile = false, chatHistoryMatch }: TaskCardProps) {
  const { selectedTaskId, selectTask, deleteTask } = useTaskStore();
  const { projects, selectedProjectIds, isAllProjectsMode } = useProjectStore();
  const isSelected = selectedTaskId === task.id;

  // Helper function to highlight matched text
  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} style={{ color: '#d87756', backgroundColor: 'transparent', fontWeight: 'bold' }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Show project badge when viewing multiple projects
  const showProjectBadge = isAllProjectsMode() || selectedProjectIds.length > 1;
  const projectName = projects.find(p => p.id === task.projectId)?.name;
  const showDeleteButton = task.status === 'done' || task.status === 'cancelled';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete task "${task.title}"?`)) return;
    try {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      deleteTask(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

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
        'group cursor-pointer select-none',
        // Only apply touch-none when actively dragging to allow natural scrolling
        isDragging && 'touch-none opacity-50'
      )}
    >
      <div
        // On mobile: don't make card draggable (use handle only to prevent scroll conflicts)
        {...(isMobile ? {} : { ...attributes, ...listeners })}
        className={cn(
          'relative bg-card rounded-lg border border-border',
          'px-2.5 py-2.5 transition-all duration-200',
          'hover:border-border/80 hover:shadow-sm',
          !isMobile && 'cursor-grab active:cursor-grabbing',
          isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background border-transparent',
          isDragging && 'shadow-lg'
        )}
        onClick={(e) => {
          // Only open detail panel if this wasn't a drag operation
          if (!isDragging) {
            selectTask(task.id);
          }
        }}
      >
        {/* Drag handle - on mobile: visible & draggable; on desktop: hover indicator only */}
        <button
          {...(isMobile ? { ...attributes, ...listeners } : {})}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 p-1 rounded',
            'text-muted-foreground/50 hover:text-muted-foreground',
            isMobile
              ? 'left-0 opacity-100 cursor-grab active:cursor-grabbing touch-none'
              : '-left-1 -translate-x-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
            'hover:bg-muted'
          )}
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>

        {/* Delete button - always visible for Done/Cancelled tasks */}
        {showDeleteButton && (
          <button
            onClick={handleDelete}
            className={cn(
              'absolute right-1 top-1 p-1 rounded',
              'text-muted-foreground hover:text-destructive',
              'hover:bg-muted pointer-events-auto z-10'
            )}
            aria-label="Delete task"
          >
            <Trash2 className="size-3" />
          </button>
        )}

        <div className={cn(isMobile ? 'pl-4' : 'pl-1', showDeleteButton && 'pr-6')}>
          {/* Header: Project badge - smaller */}
          {showProjectBadge && projectName && (
            <div style={{ marginBottom: '5px', lineHeight: '10px' }}>
              <span className="inline-flex items-center text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                {projectName}
              </span>
            </div>
          )}

          {/* Title - only show if exists and different from description */}
          {task.title && task.title !== task.description && (
            <h3 className="font-semibold text-sm leading-snug text-card-foreground line-clamp-2">
              {highlightText(task.title)}
            </h3>
          )}

          {/* Description - show as main content if no title, otherwise as subtitle */}
          {task.description && (
            <p className={cn(
              'text-[13px] leading-relaxed line-clamp-2',
              !task.title || task.title === task.description ? 'text-card-foreground' : 'mt-1 text-muted-foreground'
            )}>
              {highlightText(task.description)}
            </p>
          )}

          {/* Chat history match - show matched sentence from conversation */}
          {chatHistoryMatch && (
            <div className="mt-2 pt-1.5 border-t border-border/50">
              <div className="flex items-start gap-1.5">
                <Search className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2 italic">
                  {highlightText(chatHistoryMatch.matchedText)}
                </p>
              </div>
            </div>
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
