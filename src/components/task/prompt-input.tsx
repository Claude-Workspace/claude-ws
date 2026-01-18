'use client';

import { useState, FormEvent, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Command, Paperclip, Square, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { CommandSelector } from './command-selector';
import { FileDropZone } from './file-drop-zone';
import { AttachmentBar } from './attachment-bar';
import { FileMentionDropdown } from './file-mention-dropdown';
import { FileIcon } from '@/components/sidebar/file-browser/file-icon';
import { useInteractiveCommandStore } from '@/stores/interactive-command-store';
import { useAttachmentStore } from '@/stores/attachment-store';
import { useContextMentionStore } from '@/stores/context-mention-store';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface PromptInputRef {
  submit: () => void;
  focus: () => void;
}

interface PromptInputProps {
  onSubmit: (prompt: string, displayPrompt?: string, fileIds?: string[]) => void;
  onCancel?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  taskId?: string;
  hideSendButton?: boolean;
  disableSubmitShortcut?: boolean;
  onChange?: (prompt: string) => void;
  initialValue?: string;
}

export const PromptInput = forwardRef<PromptInputRef, PromptInputProps>(({
  onSubmit,
  onCancel,
  disabled = false,
  placeholder = 'Describe what you want Claude to do... (type / for commands)',
  className,
  taskId,
  hideSendButton = false,
  disableSubmitShortcut = false,
  onChange,
  initialValue,
}, ref) => {
  const [prompt, setPrompt] = useState(initialValue || '');
  const [showCommands, setShowCommands] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  // File mention state (for @ dropdown)
  const [showFileMention, setShowFileMention] = useState(false);
  const [fileMentionQuery, setFileMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  // Context mention store (for both @file and @file#lines from Cmd+L)
  const { getMentions, addFileMention, removeMention, clearMentions, buildPromptWithMentions } = useContextMentionStore();
  const mentions = taskId ? getMentions(taskId) : [];
  const [taskStats, setTaskStats] = useState<{
    totalTokens: number;
    totalCostUSD: number;
    totalTurns: number;
    totalDurationMs: number;
    totalAdditions: number;
    totalDeletions: number;
    filesChanged: number;
    contextUsed: number;
    contextLimit: number;
    contextPercentage: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openCommand } = useInteractiveCommandStore();

  // Attachment store
  const {
    getPendingFiles,
    addFiles,
    removeFile,
    clearFiles,
    retryUpload,
    getUploadedFileIds,
    hasUploadingFiles,
  } = useAttachmentStore();

  const pendingFiles = taskId ? getPendingFiles(taskId) : [];

  // Wrapper to update prompt and notify parent
  const updatePrompt = (newPrompt: string) => {
    setPrompt(newPrompt);
    onChange?.(newPrompt);
  };

  // Detect @ mention for file search
  const checkForFileMention = useCallback((text: string, cursorPos: number) => {
    // Look backwards from cursor to find @
    let atIndex = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];
      if (char === '@') {
        atIndex = i;
        break;
      }
      // Stop if we hit a space or newline before finding @
      if (char === ' ' || char === '\n') {
        break;
      }
    }

    if (atIndex >= 0) {
      const query = text.slice(atIndex + 1, cursorPos);
      // Only show if query doesn't contain spaces (still typing the filename)
      if (!query.includes(' ')) {
        setShowFileMention(true);
        setFileMentionQuery(query);
        setMentionStartIndex(atIndex);
        return;
      }
    }

    setShowFileMention(false);
    setFileMentionQuery('');
    setMentionStartIndex(-1);
  }, []);

  // Handle file selection from dropdown
  const handleFileSelect = useCallback((filePath: string) => {
    if (mentionStartIndex >= 0 && taskId) {
      // Get just the filename for display
      const fileName = filePath.split('/').pop() || filePath;

      // Remove the @query from textarea (just show chip above)
      const before = prompt.slice(0, mentionStartIndex);
      const cursorPos = textareaRef.current?.selectionStart || prompt.length;
      const after = prompt.slice(cursorPos);
      const newPrompt = `${before}${after}`.trim();
      updatePrompt(newPrompt);

      // Add to context mention store
      addFileMention(taskId, fileName, filePath);

      // Focus back on textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
    setShowFileMention(false);
    setFileMentionQuery('');
    setMentionStartIndex(-1);
  }, [mentionStartIndex, prompt, updatePrompt, taskId, addFileMention]);

  const handleFileMentionClose = useCallback(() => {
    setShowFileMention(false);
    setFileMentionQuery('');
    setMentionStartIndex(-1);
  }, []);

  // Remove a mentioned file/lines
  const handleRemoveMention = useCallback((displayName: string) => {
    if (taskId) {
      removeMention(taskId, displayName);
    }
  }, [taskId, removeMention]);

  // Detect slash command input
  useEffect(() => {
    // Clear selected command if prompt no longer matches it
    if (selectedCommand && !prompt.startsWith(`/${selectedCommand}`)) {
      setSelectedCommand(null);
    }

    if (prompt.startsWith('/') && !selectedCommand) {
      setShowCommands(true);
      const filter = prompt.slice(1).split(' ')[0];
      setCommandFilter(filter);
    } else if (!prompt.startsWith('/')) {
      setShowCommands(false);
      setCommandFilter('');
    }
  }, [prompt, selectedCommand]);

  // Fetch task stats when taskId changes
  useEffect(() => {
    if (!taskId) return;

    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/stats`);
        if (res.ok) {
          const data = await res.json();
          setTaskStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch task stats:', error);
      }
    };

    fetchStats();
    // Poll every 5 seconds while task is open
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleFilesSelected = async (files: File[]) => {
    if (!taskId) return;
    try {
      await addFiles(taskId, files);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload files');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Allow submit if there's text OR context mentions
    if ((!prompt.trim() && mentions.length === 0) || disabled) return;

    // Check if files are still uploading
    if (taskId && hasUploadingFiles(taskId)) {
      toast.error('Please wait for files to finish uploading');
      return;
    }

    const originalPrompt = prompt.trim();
    let finalPrompt = originalPrompt;
    let displayPrompt: string | undefined;

    // Build prompt with context mentions (files and lines)
    if (taskId && mentions.length > 0) {
      const result = buildPromptWithMentions(taskId, originalPrompt);
      finalPrompt = result.finalPrompt;
      displayPrompt = result.displayPrompt;
    }

    // If it's a command, process it
    if (selectedCommand || prompt.startsWith('/')) {
      const match = prompt.match(/^\/(\w+)(?::(\w+))?\s*(.*)/);
      if (match) {
        const [, cmdName, subCmd, args] = match;
        displayPrompt = originalPrompt;
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
          }
        } catch (error) {
          console.error('Failed to process command:', error);
        }
      }
    }

    // Get uploaded file IDs
    const fileIds = taskId ? getUploadedFileIds(taskId) : [];

    onSubmit(finalPrompt, displayPrompt, fileIds.length > 0 ? fileIds : undefined);

    // Clear state
    updatePrompt('');
    setSelectedCommand(null);
    setShowCommands(false);
    if (taskId) {
      clearMentions(taskId);
      clearFiles(taskId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let file mention dropdown handle these keys when visible
    if (showFileMention && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape')) {
      // Don't prevent default for Tab/Enter if no results - those are handled by dropdown
      return;
    }

    if (showCommands && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
      return;
    }

    // Enter to send, Shift+Enter or Ctrl+Enter for newline
    if (!disableSubmitShortcut && e.key === 'Enter') {
      if (e.shiftKey || e.ctrlKey) {
        // Allow newline (default behavior)
        return;
      }
      // Send message
      e.preventDefault();
      handleSubmit(e as any);
    }

    if (e.key === 'Escape') {
      if (showFileMention) {
        e.preventDefault();
        handleFileMentionClose();
      } else if (showCommands) {
        e.preventDefault();
        setShowCommands(false);
        updatePrompt('');
      }
    }
  };

  // Handle input change - check for @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    updatePrompt(newValue);

    // Check for file mention
    const cursorPos = e.target.selectionStart || 0;
    checkForFileMention(newValue, cursorPos);
  };

  const handleCommandSelect = (command: string, isInteractive?: boolean) => {
    if (isInteractive && taskId) {
      setShowCommands(false);
      updatePrompt('');

      switch (command) {
        case 'rewind':
          openCommand({ type: 'rewind', taskId });
          break;
        case 'model':
          openCommand({ type: 'model', currentModel: 'claude-sonnet-4-20250514' });
          break;
        case 'config':
          openCommand({ type: 'config' });
          break;
        case 'clear':
          openCommand({ type: 'clear', taskId });
          break;
        case 'compact':
          openCommand({ type: 'compact', taskId });
          break;
        default:
          const cmdText = `/${command} `;
          updatePrompt(cmdText);
          setSelectedCommand(command);
          textareaRef.current?.focus();
      }
      return;
    }

    const cmdText = `/${command} `;
    updatePrompt(cmdText);
    setSelectedCommand(command);
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  const handleCommandClose = () => {
    setShowCommands(false);
    if (prompt === '/' || (prompt.startsWith('/') && !prompt.includes(' '))) {
      updatePrompt('');
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Expose submit and focus functions to parent via ref
  useImperativeHandle(ref, () => ({
    submit: () => {
      if (!prompt.trim() || disabled) return;
      handleSubmit({ preventDefault: () => { } } as FormEvent);
    },
    focus: () => {
      textareaRef.current?.focus();
    },
  }));

  return (
    <FileDropZone
      onFilesSelected={handleFilesSelected}
      disabled={disabled}
      className={cn('relative flex flex-col overflow-x-hidden', className)}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full min-w-0 overflow-x-hidden">
        {/* Command Selector */}
        <CommandSelector
          isOpen={showCommands}
          onSelect={handleCommandSelect}
          onClose={handleCommandClose}
          filter={commandFilter}
        />

        {/* Context Mentions Bar (files and line selections) */}
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {mentions.map((mention) => (
              <div
                key={mention.displayName}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted/80 rounded text-xs group"
                title={mention.type === 'lines' ? `${mention.filePath}#L${mention.startLine}-${mention.endLine}` : mention.filePath}
              >
                <FileIcon name={mention.fileName} type="file" className="size-3" />
                <span className="text-foreground">{mention.displayName}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveMention(mention.displayName)}
                  className="text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Attachment Bar */}
        {taskId && pendingFiles.length > 0 && (
          <AttachmentBar
            files={pendingFiles}
            onRemove={(tempId) => removeFile(taskId, tempId)}
            onRetry={(tempId) => retryUpload(taskId, tempId)}
            onAddFiles={openFilePicker}
          />
        )}

        {/* Input area */}
        <div className="w-full min-w-0 max-w-full">
          {/* File Mention Dropdown */}
          <FileMentionDropdown
            query={fileMentionQuery}
            onSelect={handleFileSelect}
            onClose={handleFileMentionClose}
            visible={showFileMention}
          />

          {/* Textarea and buttons as a single block */}
          <div className={cn(
            'rounded-md border overflow-hidden bg-background w-full max-w-full',
            selectedCommand ? 'border-primary' : 'border-input'
          )}>
            <div className="relative w-full max-w-full">
              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  // Set cursor position on focus (removed scrollIntoView to prevent layout shift)
                  setTimeout(() => {
                    textareaRef.current?.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
                  }, 100);
                }}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                  'min-h-10 max-h-48 resize-none w-full break-words overflow-y-auto border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base',
                  selectedCommand && 'border-primary'
                )}
                style={{ fontSize: '16px' }}
              />
              {selectedCommand && (
                <div className="absolute top-2 right-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                    <Command className="size-3" />
                    {selectedCommand}
                  </span>
                </div>
              )}
            </div>

            {/* Buttons row - below textarea */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-transparent dark:bg-input/30">
              {/* File upload button - left */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={openFilePicker}
                disabled={disabled}
                title="Attach files"
                className="size-8"
              >
                <Paperclip className="size-4" />
              </Button>

              {/* Send/Stop button - right */}
              {!hideSendButton && (
                disabled && onCancel ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={onCancel}
                  >
                    <Square className="size-4" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={disabled || (!prompt.trim() && mentions.length === 0)}
                    size="sm"
                  >
                    {disabled ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        Send
                      </>
                    )}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Command hints and Task Stats - Mobile responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          {/* Command hints - Hide on mobile */}
          <div className="hidden sm:flex flex-col gap-px">
            <p className="text-[10px] text-muted-foreground">
              <kbd className="px-0.5 bg-muted rounded text-[9px]">/</kbd> commands
              <span className="mx-1">·</span>
              <kbd className="px-0.5 bg-muted rounded text-[9px]">@</kbd> files
            </p>
            {!disableSubmitShortcut && (
              <p className="text-[10px] text-muted-foreground">
                <kbd className="px-0.5 bg-muted rounded text-[9px]">Enter</kbd> to send
                <span className="mx-1">·</span>
                <kbd className="px-0.5 bg-muted rounded text-[9px]">Shift</kbd>+<kbd className="px-0.5 bg-muted rounded text-[9px]">Enter</kbd> for newline
              </p>
            )}
          </div>

          {/* Task Stats - Condensed on mobile, full on desktop */}
          {taskId && (
            <div className="flex items-center gap-2 sm:gap-3 text-[10px] text-muted-foreground">
              {/* Context Usage - Compact on mobile */}
              <div className="flex items-center gap-1">
                <TrendingUp className="size-3 hidden sm:inline" />
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {/* Hide progress bar on mobile, show only percentage */}
                  <div className="hidden sm:flex gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const percentage = taskStats?.contextPercentage || 0;
                      const filled = (percentage / 10) > i;
                      let color = 'bg-muted';
                      if (filled) {
                        if (percentage > 90) {
                          color = 'bg-red-500';
                        } else if (percentage >= 60) {
                          color = 'bg-yellow-500';
                        } else {
                          color = 'bg-green-500';
                        }
                      }
                      return (
                        <div
                          key={i}
                          className={`w-1.5 h-2 rounded-[1px] ${color}`}
                        />
                      );
                    })}
                  </div>
                  <span className={`font-medium text-[9px] sm:text-[10px] ${
                    (taskStats?.contextPercentage || 0) > 90
                      ? 'text-red-500'
                      : (taskStats?.contextPercentage || 0) >= 60
                        ? 'text-yellow-500'
                        : ''
                  }`}>
                    {taskStats?.contextPercentage || 0}%
                  </span>
                </div>
              </div>

              {/* Cost - Compact on mobile */}
              {taskStats && taskStats.totalCostUSD > 0 && (
                <div className="flex items-center gap-0.5">
                  <span className="hidden sm:inline">💵</span>
                  <span className="font-medium text-[9px] sm:text-[10px]">${taskStats.totalCostUSD.toFixed(2)}</span>
                </div>
              )}

              {/* Git changes - Compact on mobile */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                <span className="hidden sm:inline">📝</span>
                <span className="text-green-600 text-[9px] sm:text-[10px]">+{taskStats?.totalAdditions || 0}</span>
                <span className="text-red-600 text-[9px] sm:text-[10px]">-{taskStats?.totalDeletions || 0}</span>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Hidden file input for Paperclip button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.ts,.tsx,.js,.jsx,.json,.css,.html"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            handleFilesSelected(files);
          }
          e.target.value = '';
        }}
        disabled={disabled}
      />
    </FileDropZone>
  );
});

PromptInput.displayName = 'PromptInput';

