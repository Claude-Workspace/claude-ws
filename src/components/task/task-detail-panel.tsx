'use client';

import { useState, useCallback } from 'react';
import { X, Wifi, WifiOff, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PromptInput } from './prompt-input';
import { ConversationView } from './conversation-view';
import { useTaskStore } from '@/stores/task-store';
import { useAttemptStream } from '@/hooks/use-attempt-stream';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/types';

interface TaskDetailPanelProps {
  className?: string;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  todo: { label: 'To Do', variant: 'outline' },
  in_progress: { label: 'In Progress', variant: 'secondary' },
  in_review: { label: 'In Review', variant: 'default' },
  done: { label: 'Done', variant: 'default' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export function TaskDetailPanel({ className }: TaskDetailPanelProps) {
  const { selectedTask, setSelectedTask, updateTaskStatus } = useTaskStore();
  const [conversationKey, setConversationKey] = useState(0);

  // Handle task completion - move to review and show notification
  const handleTaskComplete = useCallback(
    async (taskId: string) => {
      await updateTaskStatus(taskId, 'in_review');
      toast.success('Task completed!', {
        description: 'Moved to In Review',
      });
    },
    [updateTaskStatus]
  );

  const { messages, startAttempt, isRunning, isConnected, currentAttemptId, currentPrompt } = useAttemptStream({
    taskId: selectedTask?.id,
    onComplete: handleTaskComplete,
  });

  if (!selectedTask) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[selectedTask.status];

  const handleClose = () => {
    setSelectedTask(null);
  };

  const handlePromptSubmit = (prompt: string, displayPrompt?: string) => {
    startAttempt(selectedTask.id, prompt, displayPrompt);
  };

  const handleRefreshConversation = () => {
    setConversationKey((k) => k + 1);
  };

  return (
    <div
      className={cn(
        'fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-[600px] bg-background border-l shadow-xl flex flex-col z-40',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            {isConnected ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Wifi className="size-3" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <WifiOff className="size-3" />
                Disconnected
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold line-clamp-2">{selectedTask.title}</h2>
          {selectedTask.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
              {selectedTask.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRefreshConversation}
            title="Refresh conversation"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Conversation View */}
      <div className="flex-1 overflow-hidden min-w-0">
        <ConversationView
          key={conversationKey}
          taskId={selectedTask.id}
          currentMessages={messages}
          currentAttemptId={currentAttemptId}
          currentPrompt={currentPrompt || undefined}
          isRunning={isRunning}
        />
      </div>

      <Separator />

      {/* Prompt Input */}
      <div className="p-4">
        <PromptInput onSubmit={handlePromptSubmit} disabled={isRunning} />
      </div>
    </div>
  );
}
