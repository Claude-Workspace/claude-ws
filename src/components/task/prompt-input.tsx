'use client';

import { useState, FormEvent, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Command, ImagePlus, Square } from 'lucide-react';
import { toast } from 'sonner';
import { CommandSelector } from './command-selector';
import { FileDropZone } from './file-drop-zone';
import { AttachmentBar } from './attachment-bar';
import { useInteractiveCommandStore } from '@/stores/interactive-command-store';
import { useAttachmentStore } from '@/stores/attachment-store';
import { cn } from '@/lib/utils';

export interface PromptInputRef {
  submit: () => void;
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
    if (!prompt.trim() || disabled) return;

    // Check if files are still uploading
    if (taskId && hasUploadingFiles(taskId)) {
      toast.error('Please wait for files to finish uploading');
      return;
    }

    const originalPrompt = prompt.trim();
    let finalPrompt = originalPrompt;
    let displayPrompt: string | undefined;

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
      clearFiles(taskId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
      return;
    }

    if (!disableSubmitShortcut && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as any);
    }

    if (e.key === 'Escape' && showCommands) {
      e.preventDefault();
      setShowCommands(false);
      updatePrompt('');
    }
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

  // Expose submit function to parent via ref
  useImperativeHandle(ref, () => ({
    submit: () => {
      if (!prompt.trim() || disabled) return;
      handleSubmit({ preventDefault: () => { } } as FormEvent);
    },
  }));

  return (
    <FileDropZone
      onFilesSelected={handleFilesSelected}
      disabled={disabled}
      className={cn('relative flex flex-col', className)}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full min-w-0">
        {/* Command Selector */}
        <CommandSelector
          isOpen={showCommands}
          onSelect={handleCommandSelect}
          onClose={handleCommandClose}
          filter={commandFilter}
        />

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
        <div className="relative w-full min-w-0">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => updatePrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // Scroll to bottom of textarea on focus (for mobile virtual keyboard)
              setTimeout(() => {
                textareaRef.current?.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
                textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'min-h-24 max-h-48 resize-none pr-10 w-full break-words overflow-y-auto',
              selectedCommand && 'border-primary'
            )}
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

        {!hideSendButton && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-px">
              <p className="text-[10px] text-muted-foreground">
                Type <kbd className="px-0.5 bg-muted rounded text-[9px]">/</kbd> for commands
              </p>
              {!disableSubmitShortcut && (
                <p className="text-[10px] text-muted-foreground">
                  <kbd className="px-0.5 bg-muted rounded text-[9px]">
                    {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}
                  </kbd>
                  +<kbd className="px-0.5 bg-muted rounded text-[9px]">Enter</kbd> to send
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={openFilePicker}
                disabled={disabled}
                title="Attach images & files"
                className="size-8"
              >
                <ImagePlus className="size-4" />
              </Button>
              {disabled && onCancel ? (
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
                <Button type="submit" disabled={disabled || !prompt.trim()} size="sm">
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
              )}
            </div>
          </div>
        )}
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
