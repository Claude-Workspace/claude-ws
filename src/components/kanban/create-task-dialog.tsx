'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PromptInput } from '@/components/task/prompt-input';
import { useTaskStore } from '@/stores/task-store';
import { useProjectStore } from '@/stores/project-store';

import { Task } from '@/types';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (task: Task, startNow: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange, onTaskCreated }: CreateTaskDialogProps) {
  const { createTask } = useTaskStore();
  const {
    projects,
    selectedProjectIds,
    activeProjectId,
    isAllProjectsMode,
    getSelectedProjects
  } = useProjectStore();

  const [title, setTitle] = useState('');
  const [chatPrompt, setChatPrompt] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get available projects for the dropdown
  const availableProjects = getSelectedProjects();
  const isMultiProject = isAllProjectsMode() || selectedProjectIds.length !== 1;

  // Set default project when dialog opens
  useEffect(() => {
    if (open) {
      // Priority: activeProjectId > first selectedProjectId > first project
      const defaultProject = activeProjectId
        || (selectedProjectIds.length > 0 ? selectedProjectIds[0] : null)
        || (projects.length > 0 ? projects[0].id : null);
      setSelectedProjectId(defaultProject || '');
    }
  }, [open, activeProjectId, selectedProjectIds, projects]);

  const handleSubmit = async (startNow = false) => {
    if (!chatPrompt.trim()) {
      setError('Message is required');
      return;
    }

    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Use title if provided, otherwise use message as title
      const taskTitle = title.trim() || chatPrompt.trim();
      const task = await createTask(selectedProjectId, taskTitle, chatPrompt.trim());

      // Notify parent that task was created
      onTaskCreated?.(task, startNow);

      // Reset form
      setTitle('');
      setChatPrompt('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromptSubmit = (prompt: string, displayPrompt?: string) => {
    setChatPrompt(displayPrompt || prompt);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      if (!newOpen) {
        setTitle('');
        setChatPrompt('');
        setSelectedProjectId('');
        setError(null);
      }
      onOpenChange(newOpen);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to your Kanban board. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Project selector - show when multi-project mode */}
          {isMultiProject && (
            <div className="space-y-2">
              <label htmlFor="project" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                id="project"
                className="w-full border rounded-md p-2 text-sm bg-background"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Select a project...</option>
                {availableProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Message <span className="text-red-500">*</span>
            </label>
            <PromptInput
              key={open ? 'create-task-input' : 'closed'}
              onSubmit={handlePromptSubmit}
              onChange={setChatPrompt}
              placeholder="Describe what you want Claude to do... (type / for commands)"
              disabled={isSubmitting}
              hideSendButton
              disableSubmitShortcut
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Title <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="title"
              placeholder="Enter custom title (defaults to message if empty)..."
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
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !chatPrompt.trim()}
            >
              {isSubmitting ? 'Starting...' : 'Start now'}
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || !chatPrompt.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
