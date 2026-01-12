'use client';

/**
 * Inline Edit Dialog - Cursor-style floating toolbar for AI code editing
 *
 * Shows instruction input when prompting, Accept/Reject buttons when previewing.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Loader2, Check, RotateCcw } from 'lucide-react';
import { useInlineEditStore } from '@/stores/inline-edit-store';

interface InlineEditDialogProps {
  filePath: string;
  onSubmit: (instruction: string) => void;
  onAccept: () => void;
  onReject: () => void;
}

export function InlineEditDialog({ filePath, onSubmit, onAccept, onReject }: InlineEditDialogProps) {
  const [instruction, setInstruction] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const { dialogOpen, dialogFilePath, dialogPosition, closeDialog, getSession } = useInlineEditStore();
  const session = getSession(filePath);

  const isOpen = dialogOpen && dialogFilePath === filePath;
  const isGenerating = session?.status === 'generating';
  const isPreview = session?.status === 'preview';
  const error = session?.error;
  const sessionInstruction = session?.instruction || '';

  // Calculate adjusted position
  const adjustedPosition = useMemo(() => {
    if (!dialogPosition) return null;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;

    let x = dialogPosition.x;
    let y = dialogPosition.y - 50;

    const width = isPreview ? 550 : 450;

    if (x + width > viewportWidth - 20) {
      x = viewportWidth - width - 20;
    }
    if (x < 20) {
      x = 20;
    }
    if (y < 20) {
      y = dialogPosition.y + 25;
    }

    return { x, y };
  }, [dialogPosition, isPreview]);

  // Focus input when dialog opens (only in prompting mode)
  useEffect(() => {
    if (isOpen && !isPreview && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, isPreview]);

  // Clear instruction when dialog closes
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      const timer = setTimeout(() => setInstruction(''), 0);
      return () => clearTimeout(timer);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Global keyboard handler for accept/reject in preview mode
  useEffect(() => {
    if (!isPreview) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to accept
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onAccept();
      }
      // Cmd/Ctrl + Backspace to reject
      if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onReject();
      }
      // Escape to reject
      if (e.key === 'Escape') {
        e.preventDefault();
        onReject();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPreview, onAccept, onReject]);

  const handleSubmit = useCallback(() => {
    if (!instruction.trim() || isGenerating) return;
    onSubmit(instruction.trim());
  }, [instruction, isGenerating, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
        onReject();
      }
    },
    [handleSubmit, closeDialog, onReject]
  );

  const handleClose = useCallback(() => {
    if (!isGenerating) {
      closeDialog();
      onReject();
    }
  }, [closeDialog, isGenerating, onReject]);

  // Show dialog in preview mode OR when prompting/generating
  const shouldShow = isOpen || isPreview;
  if (!shouldShow || !adjustedPosition) return null;

  // Preview mode - show Accept/Reject toolbar (same width as input mode)
  if (isPreview) {
    return createPortal(
      <div
        ref={popupRef}
        className="fixed z-[9999] w-[450px] max-w-[calc(100vw-40px)]"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl p-2 flex items-center gap-2">
          {/* Instruction text */}
          <span className="flex-1 text-sm text-zinc-300 truncate" title={sessionInstruction}>
            {sessionInstruction}
          </span>

          {/* Accept */}
          <button
            onClick={onAccept}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1"
          >
            Accept <span className="text-zinc-500">⌘↵</span>
          </button>

          {/* Reject */}
          <button
            onClick={onReject}
            className="text-xs text-zinc-400 hover:text-zinc-300 font-medium px-2 py-1"
          >
            Reject <span className="text-zinc-500">Esc</span>
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 p-1"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Prompting/Generating mode - show input
  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] w-[450px] max-w-[calc(100vw-40px)]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl p-2 flex items-center gap-2">
        <Input
          ref={inputRef}
          placeholder="Describe the change you want..."
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          className="flex-1 h-8 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-500 text-sm text-zinc-200"
        />

        {error && (
          <span className="text-xs text-red-400 truncate max-w-[80px]" title={error}>
            Error
          </span>
        )}

        {isGenerating ? (
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Loader2 className="size-4 animate-spin" />
            <span>Generating...</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!instruction.trim()}
            className="h-7 px-3 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium"
          >
            Submit
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          disabled={isGenerating}
          className="size-7 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>,
    document.body
  );
}
