'use client';

import { useCallback } from 'react';
import { Task, TaskStatus, KANBAN_COLUMNS } from '@/types';
import { Trash2, Copy, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useTaskStore } from '@/stores/task-store';
import { toast } from 'sonner';

interface TaskCardContextMenuProps {
  task: Task;
  children: React.ReactNode;
}

/** Status ID to i18n label mapping, defined outside component to avoid re-creation */
const STATUS_LABEL_KEYS: Record<TaskStatus, string> = {
  todo: 'todo',
  in_progress: 'inProgress',
  in_review: 'inReview',
  done: 'done',
  cancelled: 'cancelled',
};

export function TaskCardContextMenu({ task, children }: TaskCardContextMenuProps) {
  const tKanban = useTranslations('kanban');
  const tTask = useTranslations('task');
  const { deleteTask, updateTaskStatus, duplicateTask } = useTaskStore();

  const handleStatusChange = useCallback(async (newStatus: TaskStatus) => {
    if (newStatus === task.status) return;
    await updateTaskStatus(task.id, newStatus);
  }, [task.id, task.status, updateTaskStatus]);

  const handleDuplicate = useCallback(async () => {
    try {
      await duplicateTask(task);
    } catch {
      toast.error(tKanban('failedToCreate'));
    }
  }, [task, duplicateTask, tKanban]);

  const handleDelete = useCallback(async () => {
    if (!confirm(tTask('deleteTaskConfirm', { title: task.title }))) return;
    try {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      deleteTask(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, [task.id, task.title, deleteTask, tTask]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ArrowRight className="size-4 mr-2" />
            {tKanban('moveTo')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40">
            {KANBAN_COLUMNS.filter(col => col.id !== task.status).map(col => (
              <ContextMenuItem key={col.id} onClick={() => handleStatusChange(col.id)}>
                {tKanban(STATUS_LABEL_KEYS[col.id])}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy className="size-4 mr-2" />
          {tKanban('duplicate')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="size-4 mr-2" />
          {tKanban('delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
