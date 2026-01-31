'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, Maximize2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PromptInput, PromptInputRef } from './prompt-input';
import { ConversationView } from './conversation-view';
import { InteractiveCommandOverlay, QuestionPrompt } from './interactive-command';
import { ShellToggleBar, ShellExpandedPanel } from './task-shell-indicator';
import { useShellStore } from '@/stores/shell-store';
import { useTaskStore } from '@/stores/task-store';
import { useProjectStore } from '@/stores/project-store';
import { useAttemptStream } from '@/hooks/use-attempt-stream';
import { useAttachmentStore } from '@/stores/attachment-store';
import { useFloatingWindowsStore } from '@/stores/floating-windows-store';
import { cn } from '@/lib/utils';
import { DetachableWindow } from '@/components/ui/detachable-window';
import type { Task, TaskStatus, PendingFile } from '@/types';

/**
 * A single floating chat window for a task.
 * Each instance maintains its own conversation state and socket connection.
 */

const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  todo: { label: 'todo', variant: 'outline' },
  in_progress: { label: 'inProgress', variant: 'secondary' },
  in_review: { label: 'inReview', variant: 'default' },
  done: { label: 'done', variant: 'default' },
  cancelled: { label: 'cancelled', variant: 'destructive' },
};

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];

interface FloatingChatWindowProps {
  task: Task;
  zIndex: number;
  onClose: () => void;
  onFocus: () => void;
}

export function FloatingChatWindow({ task, zIndex, onClose, onFocus }: FloatingChatWindowProps) {
  const t = useTranslations('chat');
  const tk = useTranslations('kanban');
  const { updateTaskStatus, setTaskChatInit, moveTaskToInProgress, updateTask, pendingAutoStartTask, pendingAutoStartPrompt, pendingAutoStartFileIds, pendingAutoStartProviderId, pendingAutoStartModelId, setPendingAutoStartTask } = useTaskStore();
  const { activeProjectId, selectedProjectIds, projects } = useProjectStore();
  const { updateWindowTask, setFloatingMode } = useFloatingWindowsStore();
  const { getPendingFiles, clearFiles } = useAttachmentStore();
  const { shells } = useShellStore();

  const [conversationKey, setConversationKey] = useState(0);
  const [currentAttemptFiles, setCurrentAttemptFiles] = useState<PendingFile[]>([]);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [shellPanelExpanded, setShellPanelExpanded] = useState(false);
  const [showQuestionPrompt, setShowQuestionPrompt] = useState(false);

  const promptInputRef = useRef<PromptInputRef>(null);
  const lastCompletedTaskRef = useRef<string | null>(null);
  const hasAutoStartedRef = useRef(false);

  // Handle task completion
  const handleTaskComplete = useCallback(
    async (taskId: string) => {
      if (lastCompletedTaskRef.current === taskId) return;
      lastCompletedTaskRef.current = taskId;
      await updateTaskStatus(taskId, 'in_review');
      // Update floating window's local task state
      updateWindowTask(taskId, { status: 'in_review' as TaskStatus });
      toast.success(t('taskCompleted'), { description: t('movedToReview') });
    },
    [updateTaskStatus, updateWindowTask, t]
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
    taskId: task.id,
    onComplete: handleTaskComplete,
  });

  // Auto-start task when pendingAutoStartTask matches this floating window's task
  useEffect(() => {
    if (
      pendingAutoStartTask &&
      task.id === pendingAutoStartTask &&
      !hasAutoStartedRef.current &&
      !isRunning &&
      isConnected &&
      (pendingAutoStartPrompt || task.description)
    ) {
      hasAutoStartedRef.current = true;

      // Move task to in_progress if not already
      if (task.status !== 'in_progress') {
        moveTaskToInProgress(task.id);
        updateWindowTask(task.id, { status: 'in_progress' as TaskStatus });
      }

      // Mark chat as initialized
      if (!task.chatInit) {
        setTaskChatInit(task.id, true);
        setHasSentFirstMessage(true);
        updateWindowTask(task.id, { chatInit: true });
      }

      // Capture fileIds and pending files before clearing
      const fileIds = pendingAutoStartFileIds || undefined;
      const pendingFiles = getPendingFiles(task.id);
      setCurrentAttemptFiles(pendingFiles);

      // Use pending provider from dialog, or fallback to project's provider
      const taskProject = projects.find(p => p.id === task.projectId);
      const providerId = pendingAutoStartProviderId || taskProject?.provider || undefined;
      const modelId = pendingAutoStartModelId || undefined;

      // Lock provider on task immediately (before starting attempt)
      const finalProviderId = providerId || 'claude-sdk';
      if (!task.provider) {
        updateTask(task.id, { provider: finalProviderId });
        updateWindowTask(task.id, { provider: finalProviderId });
      }
      if (modelId) {
        updateTask(task.id, { modelId });
        updateWindowTask(task.id, { modelId });
      }

      // Small delay to ensure component and socket are ready
      setTimeout(() => {
        if (!isRunning && hasAutoStartedRef.current && task.id === pendingAutoStartTask) {
          const promptToSend = pendingAutoStartPrompt || task.description!;
          const promptToDisplay = pendingAutoStartPrompt ? task.description! : undefined;
          startAttempt(task.id, promptToSend, promptToDisplay, fileIds, finalProviderId, modelId);

          // Clear files from attachment store after starting (they're now part of the attempt)
          clearFiles(task.id);
        }
        setPendingAutoStartTask(null);
      }, 50);
    }
    // Reset the flag when task changes
    if (task.id !== pendingAutoStartTask) {
      hasAutoStartedRef.current = false;
    }
  }, [pendingAutoStartTask, pendingAutoStartPrompt, pendingAutoStartFileIds, pendingAutoStartProviderId, pendingAutoStartModelId, task, isRunning, isConnected, setPendingAutoStartTask, startAttempt, setTaskChatInit, moveTaskToInProgress, getPendingFiles, clearFiles, projects, activeProjectId, selectedProjectIds, updateWindowTask, updateTask]);

  // Auto-show question prompt when activeQuestion appears
  useEffect(() => {
    if (activeQuestion) setShowQuestionPrompt(true);
  }, [activeQuestion]);

  // Listen for rewind-complete event
  useEffect(() => {
    const handleRewindComplete = () => {
      setConversationKey(prev => prev + 1);
      setTimeout(() => promptInputRef.current?.focus(), 100);
    };
    window.addEventListener('rewind-complete', handleRewindComplete);
    return () => window.removeEventListener('rewind-complete', handleRewindComplete);
  }, []);

  // Get current project for commands/skills
  const currentProjectId = activeProjectId || selectedProjectIds[0] || task.projectId;
  const currentProjectPath = currentProjectId
    ? projects.find(p => p.id === currentProjectId)?.path
    : undefined;
  const hasShells = currentProjectId
    ? Array.from(shells.values()).some(s => s.projectId === currentProjectId)
    : false;

  const statusConfig = STATUS_CONFIG[task.status];
  const statusLabel = tk(statusConfig.label as any);

  const handlePromptSubmit = (prompt: string, displayPrompt?: string, fileIds?: string[], providerId?: string, modelId?: string) => {
    if (task.status !== 'in_progress') {
      moveTaskToInProgress(task.id);
      updateWindowTask(task.id, { status: 'in_progress' as TaskStatus });
    }
    if (!task.chatInit && !hasSentFirstMessage) {
      setTaskChatInit(task.id, true);
      setHasSentFirstMessage(true);
      updateWindowTask(task.id, { chatInit: true });
    }
    lastCompletedTaskRef.current = null;
    const pendingFiles = getPendingFiles(task.id);
    setCurrentAttemptFiles(pendingFiles);
    // Use provided providerId from selector, or fallback to task's project setting
    const taskProject = projects.find(p => p.id === task.projectId);
    const resolvedProviderId = providerId || taskProject?.provider || undefined;
    startAttempt(task.id, prompt, displayPrompt, fileIds, resolvedProviderId, modelId);

    // Lock provider on first attempt - update local state immediately
    // This ensures the model selector shows only this provider's models
    if (!task.provider && resolvedProviderId) {
      const finalProvider = resolvedProviderId || 'claude-sdk';
      updateTask(task.id, { provider: finalProvider });
      updateWindowTask(task.id, { provider: finalProvider });
    }

    // Update local task store and floating window's task with selected model for persistence
    if (modelId) {
      updateTask(task.id, { modelId });
      updateWindowTask(task.id, { modelId });
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleMaximize = () => {
    // Close all floating windows and select this task in the main panel
    setFloatingMode(false);
    useTaskStore.getState().selectTask(task.id);
  };

  // Render conversation view
  const renderConversation = () => (
    <div className="flex-1 overflow-hidden min-w-0 relative z-0">
      <ConversationView
        key={conversationKey}
        taskId={task.id}
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

  // Render footer with input
  const renderFooter = () => (
    <>
      <Separator />
      <div className="relative">
        {showQuestionPrompt ? (
          <div className="border-t bg-muted/30">
            {activeQuestion ? (
              <QuestionPrompt
                questions={activeQuestion.questions}
                onAnswer={(answers) => {
                  if (task.status !== 'in_progress') {
                    moveTaskToInProgress(task.id);
                    updateWindowTask(task.id, { status: 'in_progress' as TaskStatus });
                  }
                  answerQuestion(activeQuestion.questions, answers as Record<string, string>);
                  setShowQuestionPrompt(false);
                }}
                onCancel={() => {
                  cancelQuestion();
                  setShowQuestionPrompt(false);
                }}
              />
            ) : (
              <div className="py-8 px-4 text-center">
                <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                  <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Loading question...</span>
                </div>
              </div>
            )}
          </div>
        ) : shellPanelExpanded && currentProjectId ? (
          <ShellExpandedPanel
            projectId={currentProjectId}
            onClose={() => setShellPanelExpanded(false)}
          />
        ) : (
          <div className="p-3 sm:p-4">
            <PromptInput
              key={`${task.id}-${hasSentFirstMessage ? 'sent' : 'initial'}`}
              ref={promptInputRef}
              onSubmit={handlePromptSubmit}
              onCancel={cancelAttempt}
              disabled={isRunning}
              taskId={task.id}
              taskModelId={task.modelId}
              taskProviderId={task.provider}
              projectPath={currentProjectPath}
              projectProviderId={projects.find(p => p.id === task.projectId)?.provider || undefined}
              initialValue={!hasSentFirstMessage && !task.chatInit && task.description ? task.description : undefined}
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

  // Calculate offset position based on window index to avoid stacking directly on top
  const getStorageKey = () => `chat-${task.id.slice(0, 8)}`;

  return (
    <DetachableWindow
      isOpen={true}
      onClose={handleClose}
      onFocus={onFocus}
      zIndex={zIndex}
      initialSize={{ width: 500, height: 600 }}
      footer={renderFooter()}
      storageKey={getStorageKey()}
      titleCenter={task.title}
      title={
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
                      if (status !== task.status) {
                        await updateTaskStatus(task.id, status);
                        updateWindowTask(task.id, { status });
                      }
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2',
                      status === task.status && 'bg-accent/50'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Badge variant={STATUS_CONFIG[status].variant} className="text-xs">
                        {tk(STATUS_CONFIG[status].label as any)}
                      </Badge>
                    </span>
                    {status === task.status && <Check className="size-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      }
      headerEnd={
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleMaximize}
          title="Maximize to panel"
        >
          <Maximize2 className="size-4" />
        </Button>
      }
    >
      {renderConversation()}
    </DetachableWindow>
  );
}
