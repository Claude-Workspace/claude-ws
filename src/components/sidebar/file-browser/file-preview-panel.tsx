'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, AlertCircle, File, Copy, Check, GripVertical, Save, Undo, Redo, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeMirrorEditor } from '@/components/editor/code-mirror-editor';
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
const MOBILE_BREAKPOINT = 768;

export function FilePreviewPanel() {
  const activeProject = useActiveProject();
  const { previewFile, closePreview, editorPosition, setEditorPosition } = useSidebarStore();

  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Editor state
  const [originalContent, setOriginalContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Undo/Redo state
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [matchPositions, setMatchPositions] = useState<Array<{ lineNumber: number; column: number; matchLength: number }>>([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

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
      setPast([]);
      setFuture([]);
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
        setPast([]);
        setFuture([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [previewFile, activeProject?.path]);

  // Reset editor position when file changes
  useEffect(() => {
    setEditorPosition(null);
  }, [previewFile, setEditorPosition]);

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

  // Content change handler with undo/redo support
  const handleContentChange = useCallback((newContent: string) => {
    setEditedContent(newContent);
  }, []);

  // Undo handler
  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const current = editedContent;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    setEditedContent(previous);
    setPast(newPast);
    setFuture([current, ...future]);
  }, [canUndo, editedContent, past, future]);

  // Redo handler
  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const current = editedContent;
    const next = future[0];
    const newFuture = future.slice(1);

    setEditedContent(next);
    setFuture(newFuture);
    setPast([...past, current]);
  }, [canRedo, editedContent, future, past]);

  // Search handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query) {
      setTotalMatches(0);
      setCurrentMatch(0);
      setMatchPositions([]);
      setEditorPosition(null);
      return;
    }

    // Find all match positions (case-insensitive)
    const positions: Array<{ lineNumber: number; column: number; matchLength: number }> = [];
    const lines = editedContent.split('\n');
    const lowerQuery = query.toLowerCase();

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const lowerLine = line.toLowerCase();
      let col = 0;
      while (true) {
        const index = lowerLine.indexOf(lowerQuery, col);
        if (index === -1) break;
        positions.push({
          lineNumber: lineNum + 1, // CodeMirror uses 1-indexed lines
          column: index,
          matchLength: query.length
        });
        col = index + 1;
      }
    }

    setMatchPositions(positions);
    setTotalMatches(positions.length);
    setCurrentMatch(positions.length > 0 ? 1 : 0);

    // Navigate to first match
    if (positions.length > 0) {
      setEditorPosition(positions[0]);
    }
  }, [editedContent, setEditorPosition]);

  const handleNextMatch = useCallback(() => {
    if (!searchQuery || totalMatches === 0) return;
    const nextMatch = currentMatch >= totalMatches ? 1 : currentMatch + 1;
    setCurrentMatch(nextMatch);
    if (matchPositions[nextMatch - 1]) {
      setEditorPosition(matchPositions[nextMatch - 1]);
    }
    // Keep focus on search input
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [searchQuery, totalMatches, currentMatch, matchPositions, setEditorPosition]);

  const handlePrevMatch = useCallback(() => {
    if (!searchQuery || totalMatches === 0) return;
    const prevMatch = currentMatch <= 1 ? totalMatches : currentMatch - 1;
    setCurrentMatch(prevMatch);
    if (matchPositions[prevMatch - 1]) {
      setEditorPosition(matchPositions[prevMatch - 1]);
    }
    // Keep focus on search input
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [searchQuery, totalMatches, currentMatch, matchPositions, setEditorPosition]);

  const toggleSearch = useCallback(() => {
    setSearchVisible(prev => !prev);
    if (!searchVisible) {
      setSearchQuery('');
      setTotalMatches(0);
      setCurrentMatch(0);
      setMatchPositions([]);
      setEditorPosition(null);
    }
  }, [searchVisible, setEditorPosition]);

  // Track changes for undo (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editedContent !== originalContent && past[past.length - 1] !== editedContent) {
        setPast(prev => {
          // Only add if different from last state
          if (prev[prev.length - 1] !== editedContent) {
            return [...prev, editedContent];
          }
          return prev;
        });
        setFuture([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editedContent, originalContent, past]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Focus search input when search becomes visible
  useEffect(() => {
    if (searchVisible && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchVisible]);

  // Keyboard shortcut for search (Ctrl+F / Cmd+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (!searchVisible) {
          setSearchVisible(true);
        }
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible]);

  const handleCopy = async () => {
    if (content?.content) {
      await navigator.clipboard.writeText(content.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!previewFile) return null;

  const fileName = previewFile.split('/').pop() || previewFile;

  // Mobile: fullscreen popup with overlay
  if (isMobile) {
    return (
      <>
        {/* Overlay backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closePreview}
        />
        {/* Fullscreen panel */}
        <div
          ref={panelRef}
          className={cn(
            'fixed inset-0 z-50 bg-background flex flex-col',
            'animate-in slide-in-from-bottom duration-200'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold truncate">{fileName}</h2>
                {isDirty && (
                  <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded">
                    Modified
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Save status */}
              {saveStatus === 'saving' && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {saveStatus === 'saved' && (
                <Check className="size-4 text-green-500" />
              )}
              {saveStatus === 'error' && (
                <AlertCircle className="size-4 text-destructive" />
              )}
              {/* Search button */}
              {!content?.isBinary && content?.content !== null && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleSearch}
                  title="Search in file"
                  className={searchVisible ? 'bg-accent' : ''}
                >
                  <Search className="size-4" />
                </Button>
              )}
              {/* Undo/Redo buttons */}
              {!content?.isBinary && content?.content !== null && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <Redo className="size-4" />
                  </Button>
                </>
              )}
              {/* Save button */}
              {!content?.isBinary && content?.content !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  disabled={!isDirty || saveStatus === 'saving'}
                  title="Save (Ctrl+S)"
                  className="text-xs gap-1 px-2"
                >
                  <Save className="size-3" />
                  <span className="hidden sm:inline">Save</span>
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={closePreview}>
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Search bar */}
          {searchVisible && (
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-accent/30">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.shiftKey ? handlePrevMatch() : handleNextMatch();
                  } else if (e.key === 'Escape') {
                    setSearchVisible(false);
                    setSearchQuery('');
                    setTotalMatches(0);
                    setCurrentMatch(0);
                    setMatchPositions([]);
                    setEditorPosition(null);
                  }
                }}
                placeholder="Search in file..."
                className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <>
                  <span className="text-xs text-muted-foreground">
                    {currentMatch}/{totalMatches}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handlePrevMatch}
                    disabled={totalMatches === 0}
                    title="Previous match"
                  >
                    <span className="text-xs">↑</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleNextMatch}
                    disabled={totalMatches === 0}
                    title="Next match"
                  >
                    <span className="text-xs">↓</span>
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setSearchVisible(false);
                  setSearchQuery('');
                  setTotalMatches(0);
                  setCurrentMatch(0);
                  setMatchPositions([]);
                  setEditorPosition(null);
                }}
                title="Close search"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          {/* Content area - flex-1 min-h-0 is critical for scrolling */}
          <div className="flex-1 min-h-0 overflow-hidden">
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
                  <CodeMirrorEditor
                    value={editedContent}
                    onChange={handleContentChange}
                    language={content.language}
                    className="h-full"
                    editorPosition={editorPosition}
                    focusOnNavigate={!searchVisible}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // Desktop: side panel
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
          {/* Search button */}
          {!content?.isBinary && content?.content !== null && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSearch}
              title="Search in file (⌘F)"
              className={searchVisible ? 'bg-accent' : ''}
            >
              <Search className="size-4" />
            </Button>
          )}
          {/* Undo/Redo buttons */}
          {!content?.isBinary && content?.content !== null && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo className="size-4" />
              </Button>
            </>
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

      {/* Search bar */}
      {searchVisible && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-accent/30">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? handlePrevMatch() : handleNextMatch();
              } else if (e.key === 'Escape') {
                setSearchVisible(false);
                setSearchQuery('');
                setTotalMatches(0);
                setCurrentMatch(0);
                setMatchPositions([]);
                setEditorPosition(null);
              }
            }}
            placeholder="Search in file..."
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <>
              <span className="text-xs text-muted-foreground">
                {currentMatch}/{totalMatches}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handlePrevMatch}
                disabled={totalMatches === 0}
                title="Previous match (Shift+Enter)"
              >
                <span className="text-xs">↑</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleNextMatch}
                disabled={totalMatches === 0}
                title="Next match (Enter)"
              >
                <span className="text-xs">↓</span>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setSearchVisible(false);
              setSearchQuery('');
              setTotalMatches(0);
              setCurrentMatch(0);
            }}
            title="Close search (Esc)"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
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
              <CodeMirrorEditor
                value={editedContent}
                onChange={handleContentChange}
                language={content.language}
                className="h-full"
                editorPosition={editorPosition}
                focusOnNavigate={!searchVisible}
              />
            )}
          </>
        )}
      </div>

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
