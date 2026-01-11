'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, AlertCircle, File, Copy, Check, GripVertical, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useActiveProject } from '@/hooks/use-active-project';
import { cn } from '@/lib/utils';

interface FileContent {
  content: string | null;
  language: string | null;
  size: number;
  isBinary: boolean;
  mimeType: string;
}

const MIN_WIDTH = 300;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 560;

export function FilePreviewPanel() {
  const activeProject = useActiveProject();
  const { previewFile, closePreview } = useSidebarStore();

  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Editor state
  const [originalContent, setOriginalContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const isDirty = originalContent !== editedContent;
  const lineCount = editedContent.split('\n').length;
  const [currentLine, setCurrentLine] = useState<number>(1);

  // Track cursor position to highlight current line
  const updateCurrentLine = useCallback(() => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = editedContent.substring(0, cursorPos);
    const lineNumber = textBeforeCursor.split('\n').length;
    setCurrentLine(lineNumber);
  }, [editedContent]);

  // Sync scroll between line numbers and textarea
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const panelLeft = panelRef.current.getBoundingClientRect().left;
      const newWidth = e.clientX - panelLeft;
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

  useEffect(() => {
    if (!previewFile || !activeProject?.path) {
      setContent(null);
      setOriginalContent('');
      setEditedContent('');
      setSaveStatus('idle');
      return;
    }

    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/files/content?basePath=${encodeURIComponent(activeProject.path)}&path=${encodeURIComponent(previewFile)}`
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch file');
        }
        const data = await res.json();
        setContent(data);
        // Set editor content
        setOriginalContent(data.content || '');
        setEditedContent(data.content || '');
        setSaveStatus('idle');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [previewFile, activeProject?.path]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!isDirty || !previewFile || !activeProject?.path) return;

    setSaveStatus('saving');
    try {
      const res = await fetch('/api/files/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath: activeProject.path,
          path: previewFile,
          content: editedContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      // Update original to match edited (no longer dirty)
      setOriginalContent(editedContent);
      setSaveStatus('saved');

      // Reset to idle after brief feedback
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [isDirty, previewFile, activeProject?.path, editedContent]);

  // Keyboard shortcut: Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && saveStatus !== 'saving') {
          handleSave();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, saveStatus, handleSave]);

  const handleCopy = async () => {
    if (content?.content) {
      await navigator.clipboard.writeText(content.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!previewFile) return null;

  const fileName = previewFile.split('/').pop() || previewFile;

  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-r flex flex-col flex-1',
        'animate-in slide-in-from-left duration-200',
        isResizing && 'select-none'
      )}
      style={{ minWidth: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold truncate">{fileName}</h2>
            {isDirty && (
              <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                Modified
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {previewFile}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Save status indicator */}
          {saveStatus === 'saving' && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          {saveStatus === 'saved' && (
            <Check className="size-4 text-green-500" />
          )}
          {saveStatus === 'error' && (
            <AlertCircle className="size-4 text-destructive" />
          )}
          {/* Save button */}
          {!content?.isBinary && content?.content !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saveStatus === 'saving'}
              title="Save (⌘S)"
              className="text-xs gap-1"
            >
              <Save className="size-3" />
              Save
            </Button>
          )}
          {content && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(content.size)}
            </span>
          )}
          {content?.content && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              title="Copy content"
            >
              {copied ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={closePreview}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-destructive">
            <AlertCircle className="size-10 mb-3" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {content && !loading && !error && (
          <>
            {content.isBinary ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <File className="size-16 mb-3" />
                <span className="text-base">Binary file</span>
                <span className="text-sm">{content.mimeType}</span>
                <span className="text-xs mt-1">{formatFileSize(content.size)}</span>
              </div>
            ) : (
              <div className={cn(
                'flex h-full min-h-[400px] rounded-md transition-all duration-200',
                'border border-transparent',
                'focus-within:border-primary/40 focus-within:bg-primary/[0.02]',
                'focus-within:shadow-[inset_0_0_0_1px_rgba(var(--primary-rgb),0.1)]'
              )}>
                {/* Line numbers gutter */}
                <div
                  ref={lineNumbersRef}
                  className={cn(
                    'shrink-0 pt-4 pb-4 pr-3 pl-2 text-right select-none overflow-hidden',
                    'font-mono text-[13px] leading-[21px] text-muted-foreground/50',
                    'bg-muted/30 border-r border-border/50 rounded-l-md'
                  )}
                  style={{ width: `${Math.max(3, String(lineCount).length) * 0.6 + 1.2}rem` }}
                >
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div
                      key={i + 1}
                      className={cn(
                        'h-[21px] px-1 -mx-1',
                        currentLine === i + 1 && 'bg-primary/10 text-foreground rounded-sm'
                      )}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Editor textarea */}
                <textarea
                  ref={textareaRef}
                  value={editedContent}
                  onChange={(e) => {
                    setEditedContent(e.target.value);
                    updateCurrentLine();
                  }}
                  onScroll={handleScroll}
                  onClick={updateCurrentLine}
                  onKeyUp={updateCurrentLine}
                  onSelect={updateCurrentLine}
                  className={cn(
                    'flex-1 pt-4 pb-4 pl-3 pr-4 resize-none rounded-r-md',
                    'font-mono text-[13px] leading-[21px]',
                    'bg-transparent border-none outline-none',
                    'focus:ring-0 focus:outline-none',
                    'placeholder:text-muted-foreground',
                    'caret-primary'
                  )}
                  placeholder="Empty file"
                  spellCheck={false}
                />
              </div>
            )}
          </>
        )}
      </ScrollArea>

      {/* Resize handle */}
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-1.5 cursor-col-resize',
          'hover:bg-primary/20 active:bg-primary/30 transition-colors',
          'flex items-center justify-center group'
        )}
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="size-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
