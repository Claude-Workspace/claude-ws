'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Wifi, WifiOff, RotateCcw, GripVertical, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PromptInput, PromptInputRef } from './prompt-input';
import { ConversationView } from './conversation-view';
import { InteractiveCommandOverlay, QuestionPrompt } from './interactive-command';
import { useTaskStore } from '@/stores/task-store';
import { useAttemptStream } from '@/hooks/use-attempt-stream';
import { useInteractiveCommandStore } from '@/stores/interactive-command-store';
import { useAttachmentStore } from '@/stores/attachment-store';
import { cn } from '@/lib/utils';
import type { TaskStatus, PendingFile } from '@/types';

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 560;
const STORAGE_KEY = 'task-detail-width';
const MOBILE_BREAKPOINT = 768;

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

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];

export function TaskDetailPanel({ className }: TaskDetailPanelProps) {
  const { selectedTask, setSelectedTask, updateTaskStatus, setTaskChatInit, pendingAutoStartTask, setPendingAutoStartTask, moveTaskToInProgress } = useTaskStore();
  const { getPendingFiles } = useAttachmentStore();
  const [conversationKey, setConversationKey] = useState(0);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [currentAttemptFiles, setCurrentAttemptFiles] = useState<PendingFile[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<PromptInputRef>(null);
  const hasAutoStartedRef = useRef(false);
  const lastCompletedTaskRef = useRef<string | null>(null);

  // Load saved width and detect mobile
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setWidth(parsed);
      }
    }

    // Initial mobile detection
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close status dropdown when clicking outside
  useEffect(() => {
    if (!showStatusDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusDropdown]);

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
      // Prevent duplicate completion for the same task
      if (lastCompletedTaskRef.current === taskId) {
        return;
      }
      lastCompletedTaskRef.current = taskId;

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
    cancelAttempt,
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

  // Auto-start task when pendingAutoStartTask matches the selected task
  useEffect(() => {
    if (
      pendingAutoStartTask &&
      selectedTask?.id === pendingAutoStartTask &&
      !hasAutoStartedRef.current &&
      !isRunning &&
      isConnected &&
      selectedTask.description
    ) {
      hasAutoStartedRef.current = true;
      // Move task to In Progress when auto-starting
      if (selectedTask.status !== 'in_progress') {
        moveTaskToInProgress(selectedTask.id);
      }
      // Set chatInit to true on auto-start
      if (!selectedTask.chatInit) {
        setTaskChatInit(selectedTask.id, true);
        setHasSentFirstMessage(true);
      }
      // Small delay to ensure component and socket are ready
      setTimeout(() => {
        startAttempt(selectedTask.id, selectedTask.description!);
        setPendingAutoStartTask(null);
      }, 50);
    }
    // Reset the flag when task changes
    if (selectedTask?.id !== pendingAutoStartTask) {
      hasAutoStartedRef.current = false;
    }
  }, [pendingAutoStartTask, selectedTask, isRunning, isConnected, setPendingAutoStartTask, startAttempt, setTaskChatInit, moveTaskToInProgress]);

  // Reset state when selectedTask changes
  useEffect(() => {
    setConversationKey(prev => prev + 1);
    setShowStatusDropdown(false);
    setHasSentFirstMessage(false);
    setCurrentAttemptFiles([]);
    lastCompletedTaskRef.current = null;
    hasAutoStartedRef.current = false;
  }, [selectedTask?.id]);

  if (!selectedTask) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[selectedTask.status];

  const handleClose = () => {
    setSelectedTask(null);
  };

  const handlePromptSubmit = (prompt: string, displayPrompt?: string, fileIds?: string[]) => {
    // Move task to In Progress when sending a message
    if (selectedTask?.status !== 'in_progress') {
      moveTaskToInProgress(selectedTask.id);
    }
    // Set chatInit to true on first message send
    if (!selectedTask.chatInit && !hasSentFirstMessage) {
      setTaskChatInit(selectedTask.id, true);
      setHasSentFirstMessage(true);
    }

    // Reset completion tracking when starting a new attempt
    lastCompletedTaskRef.current = null;

    // Capture pending files before they get cleared
    const pendingFiles = getPendingFiles(selectedTask.id);
    setCurrentAttemptFiles(pendingFiles);
    startAttempt(selectedTask.id, prompt, displayPrompt, fileIds);
  };

  const handleRefreshConversation = () => {
    setConversationKey((k) => k + 1);
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-l flex flex-col shrink-0',
        isMobile && 'fixed inset-0 z-50 w-full border-l-0',
        isResizing && 'select-none',
        className
      )}
      style={{ width: isMobile ? undefined : `${width}px` }}
    >
      {/* Resize handle - left edge, hidden on mobile */}
      {!isMobile && (
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
      )}
      {/* Header */}
      <div className="px-3 sm:px-4 py-2 border-b">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <Badge variant={statusConfig.variant} className="cursor-pointer">
                  {statusConfig.label}
                </Badge>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-md min-w-[120px]">
                  {STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={async () => {
                        setShowStatusDropdown(false);
                        if (status !== selectedTask.status) {
                          await updateTaskStatus(selectedTask.id, status);
                        }
                      }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors',
                        status === selectedTask.status && 'bg-accent'
                      )}
                    >
                      {STATUS_CONFIG[status].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          <div className="flex items-center gap-1 shrink-0">
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
        <h2 className="text-base sm:text-lg font-semibold line-clamp-2">{selectedTask.title}</h2>
      </div>

      {/* Conversation View */}
      <div className="flex-1 overflow-hidden min-w-0">
        <ConversationView
          key={conversationKey}
          taskId={selectedTask.id}
          currentMessages={messages}
          currentAttemptId={currentAttemptId}
          currentPrompt={currentPrompt || undefined}
          currentFiles={isRunning ? currentAttemptFiles : undefined}
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
                // Move task to In Progress when answering a question
                if (selectedTask?.status !== 'in_progress') {
                  moveTaskToInProgress(selectedTask.id);
                }
                // Format all answers with their headers for Claude
                const answerParts = Object.entries(answers).map(([header, value]) => {
                  const answerStr = Array.isArray(value) ? value.join(', ') : value;
                  return `${header}: ${answerStr}`;
                });
                // Single answer: just send the value
                // Multiple answers: format as list with headers
                const fullAnswer = answerParts.length === 1
                  ? (Array.isArray(Object.values(answers)[0])
                      ? (Object.values(answers)[0] as string[]).join(', ')
                      : Object.values(answers)[0] as string)
                  : `Here are my answers:\n${answerParts.map(p => `- ${p}`).join('\n')}`;
                answerQuestion(fullAnswer);
              }}
              onCancel={cancelQuestion}
            />
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <PromptInput
              key={`${selectedTask.id}-${hasSentFirstMessage ? 'sent' : 'initial'}`}
              ref={promptInputRef}
              onSubmit={handlePromptSubmit}
              onCancel={cancelAttempt}
              disabled={isRunning}
              taskId={selectedTask.id}
              initialValue={!selectedTask.chatInit && selectedTask.description ? selectedTask.description : undefined}
            />
            <InteractiveCommandOverlay />
          </div>
        )}
      </div>
    </div>
  );
}
