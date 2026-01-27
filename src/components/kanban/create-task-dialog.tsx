'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PromptInput } from '@/components/task/prompt-input';
import { useTaskStore } from '@/stores/task-store';
import { useProjectStore } from '@/stores/project-store';
import { useAttachmentStore } from '@/stores/attachment-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';

import { Task } from '@/types';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (task: Task, startNow: boolean, processedPrompt?: string, fileIds?: string[]) => void;
}

// Temporary task ID prefix for create dialog file uploads
const TEMP_TASK_PREFIX = '__create_dialog_temp__';

export function CreateTaskDialog({ open, onOpenChange, onTaskCreated }: CreateTaskDialogProps) {
  const t = useTranslations('kanban');
  const { createTask } = useTaskStore();
  const {
    projects,
    selectedProjectIds,
    activeProjectId,
    isAllProjectsMode,
    getSelectedProjects
  } = useProjectStore();
  const { getUploadedFileIds, clearFiles, getPendingFiles, moveFiles, hasUploadingFiles } = useAttachmentStore();

  const [title, setTitle] = useState('');
  const [chatPrompt, setChatPrompt] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a stable temporary task ID for file uploads in this dialog session
  // Generate new ID each time dialog opens
  const [tempTaskId, setTempTaskId] = useState<string>('');

  // Get available projects for the dropdown
  const availableProjects = getSelectedProjects();
  const isMultiProject = isAllProjectsMode() || selectedProjectIds.length !== 1;

  // Set default project and generate new temp task ID when dialog opens
  useEffect(() => {
    if (open) {
      // Priority: activeProjectId > first selectedProjectId > first project
      const defaultProject = activeProjectId
        || (selectedProjectIds.length > 0 ? selectedProjectIds[0] : null)
        || (projects.length > 0 ? projects[0].id : null);
      setSelectedProjectId(defaultProject || '');

      // Generate new temp task ID for this dialog session
      setTempTaskId(`${TEMP_TASK_PREFIX}${Date.now()}`);
    }
  }, [open, activeProjectId, selectedProjectIds, projects]);

  const handleSubmit = async (startNow = false) => {
    if (!chatPrompt.trim()) {
      setError(t('messageRequired'));
      return;
    }

    if (!selectedProjectId) {
      setError(t('pleaseSelectProject'));
      return;
    }

    // Check if files are still uploading
    if (tempTaskId && hasUploadingFiles(tempTaskId)) {
      setError(t('waitFileUpload'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Process commands before creating task
      let finalPrompt = chatPrompt.trim();
      let descriptionForTask = chatPrompt.trim(); // Default to original input
      let processedPrompt: string | undefined;

      // Check if it's a command (starts with /)
      if (finalPrompt.startsWith('/')) {
        const match = finalPrompt.match(/^\/(\w+)(?::(\w+))?\s*(.*)/);
        if (match) {
          const [, cmdName, subCmd, args] = match;
          descriptionForTask = finalPrompt; // Keep original command as description
          try {
            const res = await fetch(`/api/commands/${cmdName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subcommand: subCmd,
                arguments: args.trim(),
              }),
            });
            if (res.ok) {
              const data = await res.json();
              finalPrompt = data.prompt;
              processedPrompt = finalPrompt; // Store processed prompt for sending
            }
          } catch (error) {
            console.error('Failed to process command:', error);
            // Continue with original prompt if command processing fails
          }
        }
      }

      // Get uploaded file IDs from temp task before creating the real task
      const fileIds = tempTaskId ? getUploadedFileIds(tempTaskId) : [];

      // Use title if provided, otherwise use message as title
      const taskTitle = title.trim() || chatPrompt.trim();
      const task = await createTask(selectedProjectId, taskTitle, descriptionForTask);

      // Move files from temp task to the real task
      if (tempTaskId && fileIds.length > 0) {
        moveFiles(tempTaskId, task.id);
      }

      // Notify parent that task was created (with fileIds)
      onTaskCreated?.(task, startNow, processedPrompt, fileIds.length > 0 ? fileIds : undefined);

      // Reset form and clear temp task ID before closing dialog
      // This ensures PromptInput gets a new key and clears its state
      setTitle('');
      setChatPrompt('');
      setTempTaskId('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCreate'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      if (!newOpen) {
        // Clear temp files when dialog is closed
        if (tempTaskId) {
          clearFiles(tempTaskId);
        }
        setTitle('');
        setChatPrompt('');
        setSelectedProjectId('');
        setError(null);
        setTempTaskId('');
      }
      onOpenChange(newOpen);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter = Start Now (run task immediately)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>{t('createNewTask')}</DialogTitle>
          <DialogDescription>
            {t('createNewTaskDescription')}
            <br />
            <span className="text-xs text-muted-foreground">
              {t('pressEnter')}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4 w-full max-w-full">
          {/* Project selector - show when multi-project mode */}
          {isMultiProject && (
            <div className="space-y-2">
              <Label htmlFor="project">
                {t('projectLabel')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectProject')} />
                </SelectTrigger>
                <SelectContent className="z-[200]" position="popper" side="bottom">
                  {availableProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              {t('messageLabel')} <span className="text-destructive">*</span>
            </Label>
            <PromptInput
              key={open ? `create-task-input-${tempTaskId}` : 'closed'}
              onSubmit={() => handleSubmit(false)}
              onChange={setChatPrompt}
              placeholder={t('typeForCommands')}
              disabled={isSubmitting}
              hideSendButton
              hideStats
              taskId={tempTaskId}
              projectPath={projects.find(p => p.id === selectedProjectId)?.path}
              minRows={2}
              maxRows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">
              {t('titleOptional')}
            </Label>
            <Input
              id="title"
              placeholder={t('enterCustomTitle')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting || !chatPrompt.trim()}
                >
                  {isSubmitting ? t('starting') : t('startNow')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>⌘/Ctrl + Enter</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting || !chatPrompt.trim()}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? t('creating') : t('createTaskButton')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Enter</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
