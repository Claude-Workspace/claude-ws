'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronDown, Minimize2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { PromptInput, PromptInputRef } from './prompt-input';
import { ConversationView } from './conversation-view';
import { InteractiveCommandOverlay, QuestionPrompt } from './interactive-command';
import { ShellToggleBar, ShellExpandedPanel } from './task-shell-indicator';
import { useResizable } from '@/hooks/use-resizable';
import { useShellStore } from '@/stores/shell-store';
import { useTaskStore } from '@/stores/task-store';
import { useProjectStore } from '@/stores/project-store';
import { usePanelLayoutStore, PANEL_CONFIGS } from '@/stores/panel-layout-store';
import { useAttemptStream } from '@/hooks/use-attempt-stream';
import { useAttachmentStore } from '@/stores/attachment-store';
import { useFloatingWindowsStore } from '@/stores/floating-windows-store';
import { useModelStore } from '@/stores/model-store';
import { useIsMobileViewport } from '@/hooks/use-mobile-viewport';
import { cn } from '@/lib/utils';
import type { TaskStatus, PendingFile } from '@/types';

const { minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH } = PANEL_CONFIGS.taskDetail;

interface TaskDetailPanelProps {
  className?: string;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  todo: { label: 'todo', variant: 'outline' },
  in_progress: { label: 'inProgress', variant: 'secondary' },
  in_review: { label: 'inReview', variant: 'default' },
  done: { label: 'done', variant: 'default' },
  cancelled: { label: 'cancelled', variant: 'destructive' },
};

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];

export function TaskDetailPanel({ className }: TaskDetailPanelProps) {
  const t = useTranslations('chat');
  const tk = useTranslations('kanban');
  const { selectedTask, setSelectedTask, updateTaskStatus, setTaskChatInit, pendingAutoStartTask, pendingAutoStartPrompt, pendingAutoStartFileIds, setPendingAutoStartTask, moveTaskToInProgress, renameTask } = useTaskStore();
  const { activeProjectId, selectedProjectIds, projects } = useProjectStore();
  const { widths, setWidth: setPanelWidth } = usePanelLayoutStore();
  const { getPendingFiles, clearFiles } = useAttachmentStore();
  const { openWindow } = useFloatingWindowsStore();
  const { getTaskModel } = useModelStore();

  const isMobile = useIsMobileViewport();
  const [conversationKey, setConversationKey] = useState(0);
  const [currentAttemptFiles, setCurrentAttemptFiles] = useState<PendingFile[]>([]);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [shellPanelExpanded, setShellPanelExpanded] = useState(false);
  const [showQuestionPrompt, setShowQuestionPrompt] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  const panelRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<PromptInputRef>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { shells } = useShellStore();
  const hasAutoStartedRef = useRef(false);
  const lastCompletedTaskRef = useRef<string | null>(null);

  const { width, isResizing, handleMouseDown: handleResizeMouseDown } = useResizable({
    initialWidth: widths.taskDetail,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    direction: 'left',
    onWidthChange: (w) => setPanelWidth('taskDetail', w),
  });

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

  // Handle task completion - move to review and show notification
  const handleTaskComplete = useCallback(
    async (taskId: string) => {
      if (lastCompletedTaskRef.current === taskId) return;
      lastCompletedTaskRef.current = taskId;

      await updateTaskStatus(taskId, 'in_review');
      toast.success(t('taskCompleted'), {
        description: t('movedToReview'),
      });
    },
    [updateTaskStatus, t]
  );

  const {
    messages,
    startAttempt,
    cancelAttempt,
    interruptAndSend,
    isRunning,
    isConnected,
    currentAttemptId,
    currentPrompt,
    activeQuestion,
    answerQuestion,
    cancelQuestion,
    refetchQuestion,
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
      (pendingAutoStartPrompt || selectedTask.description)
    ) {
      hasAutoStartedRef.current = true;
      if (selectedTask.status !== 'in_progress') {
        moveTaskToInProgress(selectedTask.id);
      }
      if (!selectedTask.chatInit) {
        setTaskChatInit(selectedTask.id, true);
        setHasSentFirstMessage(true);
      }
      const fileIds = pendingAutoStartFileIds || undefined;
      const pendingFiles = getPendingFiles(selectedTask.id);
      setCurrentAttemptFiles(pendingFiles);

      setTimeout(() => {
        if (!isRunning && hasAutoStartedRef.current && selectedTask?.id === pendingAutoStartTask) {
          const promptToSend = pendingAutoStartPrompt || selectedTask.description!;
          const promptToDisplay = pendingAutoStartPrompt ? selectedTask.description! : undefined;
          startAttempt(selectedTask.id, promptToSend, promptToDisplay, fileIds, getTaskModel(selectedTask.id, selectedTask.lastModel));
          clearFiles(selectedTask.id);
        }
        setPendingAutoStartTask(null);
      }, 50);
    }
    if (selectedTask?.id !== pendingAutoStartTask) {
      hasAutoStartedRef.current = false;
    }
  }, [pendingAutoStartTask, pendingAutoStartPrompt, pendingAutoStartFileIds, selectedTask, isRunning, isConnected, setPendingAutoStartTask, startAttempt, setTaskChatInit, moveTaskToInProgress, getPendingFiles, clearFiles, getTaskModel]);

  // Reset state when selectedTask changes
  useEffect(() => {
    setConversationKey(prev => prev + 1);
    setShowStatusDropdown(false);
    setHasSentFirstMessage(false);
    setCurrentAttemptFiles([]);
    setShellPanelExpanded(false);
    setShowQuestionPrompt(false);
    setIsEditingTitle(false);
    setEditTitleValue('');
    lastCompletedTaskRef.current = null;
    hasAutoStartedRef.current = false;

    setTimeout(() => {
      promptInputRef.current?.focus();
    }, 100);
  }, [selectedTask?.id]);

  // Auto-show question prompt when activeQuestion appears
  useEffect(() => {
    if (activeQuestion) {
      setShowQuestionPrompt(true);
    }
  }, [activeQuestion]);

  // Listen for rewind-complete event
  useEffect(() => {
    const handleRewindComplete = () => {
      setConversationKey(prev => prev + 1);
      setTimeout(() => {
        promptInputRef.current?.focus();
      }, 100);
    };

    window.addEventListener('rewind-complete', handleRewindComplete);
    return () => window.removeEventListener('rewind-complete', handleRewindComplete);
  }, []);

  // Get current project context
  const currentProjectId = activeProjectId || selectedProjectIds[0] || selectedTask?.projectId;
  const currentProjectPath = currentProjectId
    ? projects.find(p => p.id === currentProjectId)?.path
    : undefined;
  const hasShells = currentProjectId
    ? Array.from(shells.values()).some((s) => s.projectId === currentProjectId)
    : false;

  // Arrow down to open shell panel
  useEffect(() => {
    if (shellPanelExpanded || !hasShells) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
      const isWithinPanel = panelRef.current?.contains(target);

      if (e.key === 'ArrowDown' && isTyping && !e.shiftKey && !e.ctrlKey && !e.metaKey && isWithinPanel) {
        const input = target as HTMLTextAreaElement | HTMLInputElement;
        const isAtEnd = input.selectionStart === input.value.length;

        if (isAtEnd) {
          e.preventDefault();
          setShellPanelExpanded(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shellPanelExpanded, hasShells]);

  if (!selectedTask) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[selectedTask.status];
  const statusLabel = tk(statusConfig.label as any);

  const handleClose = () => {
    setSelectedTask(null);
  };

  // Detach: open floating window and deselect from panel
  const handleDetach = () => {
    openWindow(selectedTask.id, 'chat', selectedTask.projectId);
    setSelectedTask(null);
  };

  const handleStartEditTitle = () => {
    setEditTitleValue(selectedTask.title);
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleSaveTitle = async () => {
    const trimmed = editTitleValue.trim();
    if (trimmed && trimmed !== selectedTask.title) {
      try {
        await renameTask(selectedTask.id, trimmed);
      } catch {
        // Store reverts on failure, toast handled by store
      }
    }
    setIsEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
    setEditTitleValue('');
  };

  const handlePromptSubmit = (prompt: string, displayPrompt?: string, fileIds?: string[]) => {
    if (selectedTask?.status !== 'in_progress') {
      moveTaskToInProgress(selectedTask.id);
    }
    if (!selectedTask.chatInit && !hasSentFirstMessage) {
      setTaskChatInit(selectedTask.id, true);
      setHasSentFirstMessage(true);
    }

    lastCompletedTaskRef.current = null;

    const pendingFiles = getPendingFiles(selectedTask.id);
    setCurrentAttemptFiles(pendingFiles);
    startAttempt(selectedTask.id, prompt, displayPrompt, fileIds, getTaskModel(selectedTask.id, selectedTask.lastModel));
  };

  // Interrupt current streaming and send a new message
  const handleInterruptAndSend = (prompt: string, displayPrompt?: string, fileIds?: string[]) => {
    if (selectedTask?.status !== 'in_progress') {
      moveTaskToInProgress(selectedTask.id);
    }
    if (!selectedTask.chatInit && !hasSentFirstMessage) {
      setTaskChatInit(selectedTask.id, true);
      setHasSentFirstMessage(true);
    }

    lastCompletedTaskRef.current = null;

    const pendingFiles = getPendingFiles(selectedTask.id);
    setCurrentAttemptFiles(pendingFiles);
    interruptAndSend(selectedTask.id, prompt, displayPrompt, fileIds, getTaskModel(selectedTask.id, selectedTask.lastModel));
  };

  const renderConversation = () => (
    <div className="flex-1 overflow-hidden min-w-0 relative z-0">
      <ConversationView
        key={conversationKey}
        taskId={selectedTask.id}
        currentMessages={messages}
        currentAttemptId={currentAttemptId}
        currentPrompt={currentPrompt || undefined}
        currentFiles={isRunning ? currentAttemptFiles : undefined}
        isRunning={isRunning}
        activeQuestion={activeQuestion}
        onOpenQuestion={() => {
          if (activeQuestion) {
            setShowQuestionPrompt(true);
          } else {
            // activeQuestion not yet loaded — re-fetch from server
            // useEffect on activeQuestion will show the prompt when it arrives
            refetchQuestion();
          }
        }}
      />
    </div>
  );

  const renderFooter = () => (
    <>
      <Separator />
      <div className="relative">
        {showQuestionPrompt && activeQuestion ? (
          <div className="border-t bg-muted/30">
            <QuestionPrompt
              key={activeQuestion.toolUseId}
              questions={activeQuestion.questions}
              onAnswer={(answers) => {
                if (selectedTask?.status !== 'in_progress') {
                  moveTaskToInProgress(selectedTask.id);
                }
                answerQuestion(activeQuestion.questions, answers as Record<string, string>);
                setShowQuestionPrompt(false);
              }}
              onCancel={() => {
                cancelQuestion();
                setShowQuestionPrompt(false);
              }}
            />
          </div>
        ) : shellPanelExpanded && currentProjectId ? (
          <ShellExpandedPanel
            projectId={currentProjectId}
            onClose={() => setShellPanelExpanded(false)}
          />
        ) : (
          <div className="p-3 sm:p-4">
            <PromptInput
              key={`${selectedTask.id}-${hasSentFirstMessage ? 'sent' : 'initial'}`}
              ref={promptInputRef}
              onSubmit={handlePromptSubmit}
              onCancel={cancelAttempt}
              onInterruptAndSend={handleInterruptAndSend}
              isStreaming={isRunning}
              taskId={selectedTask.id}
              taskLastModel={selectedTask.lastModel}
              projectPath={currentProjectPath}
              initialValue={!hasSentFirstMessage && !selectedTask.chatInit && !pendingAutoStartTask && selectedTask.description ? selectedTask.description : undefined}
            />
            <InteractiveCommandOverlay />
          </div>
        )}
      </div>

      {currentProjectId && (
        <ShellToggleBar
          projectId={currentProjectId}
          isExpanded={shellPanelExpanded}
          onToggle={() => setShellPanelExpanded(!shellPanelExpanded)}
        />
      )}
    </>
  );

  const renderContent = () => (
    <>
      {renderConversation()}
      {renderFooter()}
    </>
  );

  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-l flex flex-col shrink-0 relative overflow-x-hidden',
        isMobile && 'fixed inset-0 z-50 border-l-0 overflow-x-hidden',
        isResizing && 'select-none',
        className
      )}
      style={{
        width: isMobile ? '100vw' : `${width}px`,
        maxWidth: isMobile ? '100vw' : undefined,
      }}
    >
      {!isMobile && (
        <ResizeHandle
          position="left"
          onMouseDown={handleResizeMouseDown}
          isResizing={isResizing}
        />
      )}
      <div className="px-3 sm:px-4 py-2 border-b w-full max-w-full overflow-visible relative z-10">
        <div className="flex items-center justify-between gap-2 mb-1 w-full">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <Badge variant={statusConfig.variant} className="cursor-pointer">
                  {statusLabel}
                </Badge>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1.5 z-[9999] bg-popover border rounded-lg shadow-lg min-w-[140px] py-1 overflow-hidden">
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
                        'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2',
                        status === selectedTask.status && 'bg-accent/50'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Badge variant={STATUS_CONFIG[status].variant} className="text-xs">
                          {tk(STATUS_CONFIG[status].label as any)}
                        </Badge>
                      </span>
                      {status === selectedTask.status && (
                        <Check className="size-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDetach}
                title="Detach to floating window"
              >
                <Minimize2 className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={handleClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveTitle();
              } else if (e.key === 'Escape') {
                handleCancelEditTitle();
              }
            }}
            className="text-base sm:text-lg font-semibold w-full bg-transparent border-b border-primary/50 outline-none py-0"
          />
        ) : (
          <h2
            className="text-base sm:text-lg font-semibold line-clamp-2 cursor-text"
            onDoubleClick={handleStartEditTitle}
          >
            {selectedTask.title}
          </h2>
        )}
      </div>

      {renderContent()}
    </div>
  );
}
