'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronDown, Minimize2, Maximize2, Check } from 'lucide-react';
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
import { useInteractiveCommandStore } from '@/stores/interactive-command-store';
import { useAttachmentStore } from '@/stores/attachment-store';
import { useFloatingWindowsStore } from '@/stores/floating-windows-store';
import { useZIndexStore } from '@/stores/z-index-store';
import { FloatingChatWindow } from './floating-chat-window';
import { cn } from '@/lib/utils';
import { DetachableWindow } from '@/components/ui/detachable-window';
import type { TaskStatus, PendingFile } from '@/types';

const { minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH } = PANEL_CONFIGS.taskDetail;
const MOBILE_BREAKPOINT = 768;

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
  const { selectedTask, setSelectedTask, updateTaskStatus, setTaskChatInit, pendingAutoStartTask, pendingAutoStartPrompt, pendingAutoStartFileIds, pendingAutoStartProviderId, pendingAutoStartModelId, setPendingAutoStartTask, moveTaskToInProgress, updateTask } = useTaskStore();
  const { activeProjectId, selectedProjectIds, projects } = useProjectStore();
  const { widths, setWidth: setPanelWidth } = usePanelLayoutStore();
  const { getPendingFiles, clearFiles } = useAttachmentStore();
  const { windows, isFloatingMode, setFloatingMode, openWindow, closeWindow, focusWindow } = useFloatingWindowsStore();
  const [conversationKey, setConversationKey] = useState(0);
  const [currentAttemptFiles, setCurrentAttemptFiles] = useState<PendingFile[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [shellPanelExpanded, setShellPanelExpanded] = useState(false);
  const [showQuestionPrompt, setShowQuestionPrompt] = useState(false);

  // Get z-index on mount for mobile mode
  const [mobileZIndex] = useState(() => useZIndexStore.getState().getNextZIndex());


  // Persist floating mode state
  useEffect(() => {
    try {
      localStorage.setItem('chat-window-detached', String(isFloatingMode));
    } catch {
      // Ignore storage errors
    }
  }, [isFloatingMode]);

  const panelRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<PromptInputRef>(null);
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

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
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

  // Handle task completion - move to review and show notification
  const handleTaskComplete = useCallback(
    async (taskId: string) => {
      // Prevent duplicate completion for the same task
      if (lastCompletedTaskRef.current === taskId) {
        return;
      }
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
      (pendingAutoStartPrompt || selectedTask.description)
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
      // Capture fileIds and pending files before clearing
      const fileIds = pendingAutoStartFileIds || undefined;
      const pendingFiles = getPendingFiles(selectedTask.id);
      setCurrentAttemptFiles(pendingFiles);

      // Use pending provider from dialog, or fallback to project's provider
      const taskProject = projects.find((p) => p.id === selectedTask.projectId);
      const providerId = pendingAutoStartProviderId || taskProject?.provider || undefined;
      const modelId = pendingAutoStartModelId || undefined;

      // Lock provider on task immediately (before starting attempt)
      const finalProviderId = providerId || 'claude-sdk';
      if (!selectedTask.provider) {
        updateTask(selectedTask.id, { provider: finalProviderId });
      }
      if (modelId) {
        updateTask(selectedTask.id, { modelId });
      }

      // Small delay to ensure component and socket are ready
      setTimeout(() => {
        // Double-check isRunning and hasAutoStartedRef to prevent duplicate starts
        if (!isRunning && hasAutoStartedRef.current && selectedTask?.id === pendingAutoStartTask) {
          // For commands: use processed prompt to send, original command for display
          // For regular messages: use the same for both
          const promptToSend = pendingAutoStartPrompt || selectedTask.description!;
          const promptToDisplay = pendingAutoStartPrompt ? selectedTask.description! : undefined;
          startAttempt(selectedTask.id, promptToSend, promptToDisplay, fileIds, finalProviderId, modelId);

          // Clear files from attachment store after starting (they're now part of the attempt)
          clearFiles(selectedTask.id);
        }
        setPendingAutoStartTask(null);
      }, 50);
    }
    // Reset the flag when task changes
    if (selectedTask?.id !== pendingAutoStartTask) {
      hasAutoStartedRef.current = false;
    }
  }, [pendingAutoStartTask, pendingAutoStartPrompt, pendingAutoStartFileIds, pendingAutoStartProviderId, pendingAutoStartModelId, selectedTask, isRunning, isConnected, setPendingAutoStartTask, startAttempt, setTaskChatInit, moveTaskToInProgress, getPendingFiles, clearFiles, projects, updateTask]);

  // Reset state when selectedTask changes
  useEffect(() => {
    setConversationKey(prev => prev + 1);
    setShowStatusDropdown(false);
    setHasSentFirstMessage(false);
    setCurrentAttemptFiles([]);
    setShellPanelExpanded(false);
    setShowQuestionPrompt(false);
    lastCompletedTaskRef.current = null;
    hasAutoStartedRef.current = false; // Reset auto-start flag when selected task changes

    // Auto-focus on chat input when task is selected
    // Small delay to ensure component is mounted
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

  // Listen for rewind-complete event to soft refresh conversation
  useEffect(() => {
    const handleRewindComplete = () => {
      // Increment key to force ConversationView re-mount and reload history
      setConversationKey(prev => prev + 1);
      // Focus on input after rewind
      setTimeout(() => {
        promptInputRef.current?.focus();
      }, 100);
    };

    window.addEventListener('rewind-complete', handleRewindComplete);
    return () => window.removeEventListener('rewind-complete', handleRewindComplete);
  }, []);

  // Get current project ID and path for commands/skills loading
  const currentProjectId = activeProjectId || selectedProjectIds[0] || selectedTask?.projectId;
  const currentProjectPath = currentProjectId
    ? projects.find(p => p.id === currentProjectId)?.path
    : undefined;
  const hasShells = currentProjectId
    ? Array.from(shells.values()).some((s) => s.projectId === currentProjectId)
    : false;

  // Arrow down to open shell panel (when typing in input at end)
  useEffect(() => {
    if (shellPanelExpanded || !hasShells) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';

      // Only handle ArrowDown if the input is within this panel
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

  // Render floating windows when in floating mode (check this BEFORE selectedTask check)
  const renderFloatingWindows = () => (
    <>
      {windows.map((window) => (
        <FloatingChatWindow
          key={window.id}
          task={window.task}
          zIndex={window.zIndex}
          onClose={() => closeWindow(window.id)}
          onFocus={() => focusWindow(window.id)}
        />
      ))}
    </>
  );

  // When in floating mode, only render the floating windows (no inline panel)
  // This check must come BEFORE the selectedTask check
  if (isFloatingMode) {
    return renderFloatingWindows();
  }

  if (!selectedTask) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[selectedTask.status];
  const statusLabel = tk(statusConfig.label as any);

  const handleClose = () => {
    setFloatingMode(false);
    setSelectedTask(null);
  };

  // Handle entering floating mode - open current task as floating window
  const handleDetach = () => {
    if (selectedTask) {
      setFloatingMode(true);
      openWindow(selectedTask);
      setSelectedTask(null); // Clear inline panel
    }
  };

  const handlePromptSubmit = (prompt: string, displayPrompt?: string, fileIds?: string[], providerId?: string, modelId?: string) => {
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

    // Use provided providerId from selector, or fallback to task's project setting
    const taskProject = projects.find((p) => p.id === selectedTask.projectId);
    const resolvedProviderId = providerId || taskProject?.provider || undefined;

    startAttempt(selectedTask.id, prompt, displayPrompt, fileIds, resolvedProviderId, modelId);

    // Lock provider on first attempt - update local state immediately
    // This ensures the model selector shows only this provider's models
    if (!selectedTask.provider && resolvedProviderId) {
      const finalProvider = resolvedProviderId || 'claude-sdk';
      useTaskStore.getState().updateTask(selectedTask.id, { provider: finalProvider });
    }

    // Update local task store with selected model for persistence
    // This keeps the UI in sync with the DB update that happens on the server
    if (modelId) {
      useTaskStore.getState().updateTask(selectedTask.id, { modelId });
    }
  };

  // Render just the conversation view
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
        onOpenQuestion={() => setShowQuestionPrompt(true)}
      />
    </div>
  );

  // Render the input area footer
  const renderFooter = () => (
    <>
      <Separator />
      {/* Prompt Input with Interactive Command Overlay or Question Prompt */}
      <div className="relative">
        {showQuestionPrompt ? (
          <div className="border-t bg-muted/30">
            {activeQuestion ? (
              <>
                <QuestionPrompt
                  questions={activeQuestion.questions}
                  onAnswer={(answers) => {
                    // Move task to In Progress when answering a question
                    if (selectedTask?.status !== 'in_progress') {
                      moveTaskToInProgress(selectedTask.id);
                    }
                    // Pass questions and answers in SDK format
                    // answers is Record<string, string> keyed by question text
                    answerQuestion(activeQuestion.questions, answers as Record<string, string>);
                    setShowQuestionPrompt(false);
                  }}
                  onCancel={() => {
                    cancelQuestion();
                    setShowQuestionPrompt(false);
                  }}
                />
              </>
            ) : (
              <>
                {/* Loading state while waiting for question data */}
                <div className="py-8 px-4 text-center">
                  <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                    <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Loading question...</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : shellPanelExpanded && currentProjectId ? (
          /* Shell Panel - replaces input when expanded */
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
              disabled={isRunning}
              taskId={selectedTask.id}
              taskModelId={selectedTask.modelId}
              taskProviderId={selectedTask.provider}
              projectPath={currentProjectPath}
              projectProviderId={projects.find((p) => p.id === selectedTask.projectId)?.provider || undefined}
              initialValue={!hasSentFirstMessage && !selectedTask.chatInit && !pendingAutoStartTask && selectedTask.description ? selectedTask.description : undefined}
            />
            <InteractiveCommandOverlay />
          </div>
        )}
      </div>

      {/* Shell Toggle Bar - always visible when shells exist */}
      {currentProjectId && (
        <ShellToggleBar
          projectId={currentProjectId}
          isExpanded={shellPanelExpanded}
          onToggle={() => setShellPanelExpanded(!shellPanelExpanded)}
        />
      )}
    </>
  );

  // Render the main content (conversation + input) - used for inline panel
  const renderContent = () => (
    <>
      {renderConversation()}
      {renderFooter()}
    </>
  );

  // Normal inline panel
  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-l flex flex-col shrink-0 relative overflow-x-hidden',
        isMobile && 'fixed inset-0 border-l-0 overflow-x-hidden',
        isResizing && 'select-none',
        className
      )}
      style={{
        width: isMobile ? '100vw' : `${width}px`,
        maxWidth: isMobile ? '100vw' : undefined,
        ...(isMobile ? { zIndex: mobileZIndex } : {}),
      }}
    >
      {/* Resize handle - left edge, hidden on mobile */}
      {!isMobile && (
        <ResizeHandle
          position="left"
          onMouseDown={handleResizeMouseDown}
          isResizing={isResizing}
        />
      )}
      {/* Header */}
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
        <h2 className="text-base sm:text-lg font-semibold line-clamp-2">{selectedTask.title}</h2>
      </div>

      {renderContent()}
    </div>
  );
}
