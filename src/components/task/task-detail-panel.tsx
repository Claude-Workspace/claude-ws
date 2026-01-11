'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Wifi, WifiOff, RotateCcw, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PromptInput } from './prompt-input';
import { ConversationView } from './conversation-view';
import { InteractiveCommandOverlay, QuestionPrompt } from './interactive-command';
import { useTaskStore } from '@/stores/task-store';
import { useAttemptStream } from '@/hooks/use-attempt-stream';
import { useInteractiveCommandStore } from '@/stores/interactive-command-store';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/types';

const MIN_WIDTH = 400;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 560;
const STORAGE_KEY = 'task-detail-width';

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
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load saved width
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setWidth(parsed);
      }
    }
  }, []);

  // Save width on change
  useEffect(() => {
    if (!isResizing) {
      localStorage.setItem(STORAGE_KEY, String(width));
    }
  }, [width, isResizing]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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

  const {
    messages,
    startAttempt,
    isRunning,
    isConnected,
    currentAttemptId,
    currentPrompt,
    activeQuestion,
    answerQuestion,
    cancelQuestion,
  } = useAttemptStream({
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
      ref={panelRef}
      className={cn(
        'h-full bg-background border-l flex flex-col shrink-0',
        isResizing && 'select-none',
        className
      )}
      style={{ width: `${width}px` }}
    >
      {/* Resize handle - left edge */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-1.5 cursor-col-resize z-10',
          'hover:bg-primary/20 active:bg-primary/30 transition-colors',
          'flex items-center justify-center group'
        )}
        onMouseDown={handleResizeMouseDown}
      >
        <GripVertical className="size-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
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

      {/* Prompt Input with Interactive Command Overlay or Question Prompt */}
      <div className="relative">
        {activeQuestion ? (
          <div className="border-t bg-muted/30">
            <QuestionPrompt
              questions={activeQuestion.questions}
              onAnswer={(answers) => {
                // For single-select, send the first answer
                // For multi-select, join with commas
                const firstAnswer = Object.values(answers)[0];
                const answerStr = Array.isArray(firstAnswer)
                  ? firstAnswer.join(', ')
                  : firstAnswer;
                answerQuestion(answerStr);
              }}
              onCancel={cancelQuestion}
            />
          </div>
        ) : (
          <div className="p-4">
            <PromptInput onSubmit={handlePromptSubmit} disabled={isRunning} taskId={selectedTask.id} />
            <InteractiveCommandOverlay />
          </div>
        )}
      </div>
    </div>
  );
}
