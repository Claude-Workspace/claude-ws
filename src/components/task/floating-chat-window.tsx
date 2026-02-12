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
import { useModelStore } from '@/stores/model-store';
import { cn } from '@/lib/utils';
import { DetachableWindow } from '@/components/ui/detachable-window';
import type { Task, TaskStatus, PendingFile } from '@/types';

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
  onMaximize: () => void;
  onFocus: () => void;
}

export function FloatingChatWindow({ task, zIndex, onClose, onMaximize, onFocus }: FloatingChatWindowProps) {
  const t = useTranslations('chat');
  const tk = useTranslations('kanban');
  const { updateTaskStatus, setTaskChatInit, moveTaskToInProgress, pendingAutoStartTask, pendingAutoStartPrompt, pendingAutoStartFileIds, setPendingAutoStartTask, renameTask } = useTaskStore();
  const { activeProjectId, selectedProjectIds, projects } = useProjectStore();
  const { getPendingFiles, clearFiles } = useAttachmentStore();
  const { shells } = useShellStore();
  const { getTaskModel } = useModelStore();

  const [conversationKey, setConversationKey] = useState(0);
  const [currentAttemptFiles, setCurrentAttemptFiles] = useState<PendingFile[]>([]);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [shellPanelExpanded, setShellPanelExpanded] = useState(false);
  const [showQuestionPrompt, setShowQuestionPrompt] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  const promptInputRef = useRef<PromptInputRef>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const lastCompletedTaskRef = useRef<string | null>(null);
  const hasAutoStartedRef = useRef(false);

  // Handle task completion
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
      if (task.status !== 'in_progress') {
        moveTaskToInProgress(task.id);
      }
      if (!task.chatInit) {
        setTaskChatInit(task.id, true);
        setHasSentFirstMessage(true);
      }
      const fileIds = pendingAutoStartFileIds || undefined;
      const pendingFiles = getPendingFiles(task.id);
      setCurrentAttemptFiles(pendingFiles);

      setTimeout(() => {
        if (!isRunning && hasAutoStartedRef.current && task.id === pendingAutoStartTask) {
          const promptToSend = pendingAutoStartPrompt || task.description!;
          const promptToDisplay = pendingAutoStartPrompt ? task.description! : undefined;
          startAttempt(task.id, promptToSend, promptToDisplay, fileIds, getTaskModel(task.id, task.lastModel));
          clearFiles(task.id);
        }
        setPendingAutoStartTask(null);
      }, 50);
    }
    if (task.id !== pendingAutoStartTask) {
      hasAutoStartedRef.current = false;
    }
  }, [pendingAutoStartTask, pendingAutoStartPrompt, pendingAutoStartFileIds, task, isRunning, isConnected, setPendingAutoStartTask, startAttempt, setTaskChatInit, moveTaskToInProgress, getPendingFiles, clearFiles, getTaskModel]);

  // Auto-show question prompt when activeQuestion appears
  useEffect(() => {
    if (activeQuestion) {
      setShowQuestionPrompt(true);
    }
  }, [activeQuestion]);

  // Get current project context
  const currentProjectId = activeProjectId || selectedProjectIds[0] || task.projectId;
  const currentProjectPath = currentProjectId
    ? projects.find(p => p.id === currentProjectId)?.path
    : undefined;
  const hasShells = currentProjectId
    ? Array.from(shells.values()).some((s) => s.projectId === currentProjectId)
    : false;

  const statusConfig = STATUS_CONFIG[task.status];
  const statusLabel = tk(statusConfig.label as any);

  const handlePromptSubmit = (prompt: string, displayPrompt?: string, fileIds?: string[]) => {
    if (task.status !== 'in_progress') {
      moveTaskToInProgress(task.id);
    }
    if (!task.chatInit && !hasSentFirstMessage) {
      setTaskChatInit(task.id, true);
      setHasSentFirstMessage(true);
    }

    lastCompletedTaskRef.current = null;

    const pendingFiles = getPendingFiles(task.id);
    setCurrentAttemptFiles(pendingFiles);
    startAttempt(task.id, prompt, displayPrompt, fileIds, getTaskModel(task.id, task.lastModel));
  };

  const handleStartEditTitle = () => {
    setEditTitleValue(task.title);
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleSaveTitle = async () => {
    const trimmed = editTitleValue.trim();
    if (trimmed && trimmed !== task.title) {
      try {
        await renameTask(task.id, trimmed);
      } catch {
        // Store reverts on failure
      }
    }
    setIsEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
    setEditTitleValue('');
  };

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

  const renderFooter = () => (
    <>
      <Separator />
      <div className="relative">
        {showQuestionPrompt ? (
          <div className="border-t bg-muted/30">
            {activeQuestion ? (
              <QuestionPrompt
                key={activeQuestion.toolUseId}
                questions={activeQuestion.questions}
                onAnswer={(answers) => {
                  if (task.status !== 'in_progress') {
                    moveTaskToInProgress(task.id);
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
              taskLastModel={task.lastModel}
              projectPath={currentProjectPath}
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

  return (
    <DetachableWindow
      isOpen={true}
      onClose={onClose}
      initialSize={{ width: 500, height: 600 }}
      footer={renderFooter()}
      storageKey={`chat-${task.id}`}
      titleCenter={
        isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            data-no-drag
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
            className="text-sm font-medium w-full bg-transparent border-b border-primary/50 outline-none text-center"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="line-clamp-2 cursor-text"
            onDoubleClick={(e) => { e.stopPropagation(); handleStartEditTitle(); }}
            onMouseDown={(e) => e.stopPropagation()}
            data-no-drag
          >
            {task.title}
          </span>
        )
      }
      zIndex={zIndex}
      onFocus={onFocus}
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
                    {status === task.status && (
                      <Check className="size-4 text-primary" />
                    )}
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
          onClick={onMaximize}
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
