'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, File, Copy, Check, Save, Undo, Redo, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeEditorWithInlineEdit } from '@/components/editor/code-editor-with-inline-edit';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useActiveProject } from '@/hooks/use-active-project';

interface FileContent {
  content: string | null;
  language: string | null;
  size: number;
  isBinary: boolean;
  mimeType: string;
}

interface FileTabContentProps {
  tabId: string;
  filePath: string;
}

export function FileTabContent({ tabId, filePath }: FileTabContentProps) {
  const activeProject = useActiveProject();
  const { editorPosition, setEditorPosition, updateTabDirty } = useSidebarStore();

  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  // Notify store of dirty state changes
  useEffect(() => {
    updateTabDirty(tabId, isDirty);
  }, [tabId, isDirty, updateTabDirty]);

  // Warn user before closing browser with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Fetch file content
  useEffect(() => {
    if (!filePath || !activeProject?.path) {
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
          `/api/files/content?basePath=${encodeURIComponent(activeProject.path)}&path=${encodeURIComponent(filePath)}`
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch file');
        }
        const data = await res.json();
        setContent(data);
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
  }, [filePath, activeProject?.path]);

  // Reset editor position when file changes
  useEffect(() => {
    setEditorPosition(null);
  }, [filePath, setEditorPosition]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!isDirty || !filePath || !activeProject?.path) return;

    setSaveStatus('saving');
    try {
      const res = await fetch('/api/files/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath: activeProject.path,
          path: filePath,
          content: editedContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setOriginalContent(editedContent);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [isDirty, filePath, activeProject?.path, editedContent]);

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

  // Content change handler
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
          lineNumber: lineNum + 1,
          column: index,
          matchLength: query.length
        });
        col = index + 1;
      }
    }

    setMatchPositions(positions);
    setTotalMatches(positions.length);
    setCurrentMatch(positions.length > 0 ? 1 : 0);

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
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [searchQuery, totalMatches, currentMatch, matchPositions, setEditorPosition]);

  const handlePrevMatch = useCallback(() => {
    if (!searchQuery || totalMatches === 0) return;
    const prevMatch = currentMatch <= 1 ? totalMatches : currentMatch - 1;
    setCurrentMatch(prevMatch);
    if (matchPositions[prevMatch - 1]) {
      setEditorPosition(matchPositions[prevMatch - 1]);
    }
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [searchQuery, totalMatches, currentMatch, matchPositions, setEditorPosition]);

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setSearchQuery('');
    setTotalMatches(0);
    setCurrentMatch(0);
    setMatchPositions([]);
    setEditorPosition(null);
  }, [setEditorPosition]);

  // Track previous content for undo (debounced)
  const lastTrackedContentRef = useRef<string>(originalContent);

  useEffect(() => {
    lastTrackedContentRef.current = originalContent;
  }, [originalContent]);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Only track if content actually changed from last tracked state
      if (editedContent !== lastTrackedContentRef.current && editedContent !== originalContent) {
        setPast(prev => [...prev, lastTrackedContentRef.current]);
        lastTrackedContentRef.current = editedContent;
        setFuture([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editedContent, originalContent]);

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

  const fileName = filePath.split('/').pop() || filePath;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{fileName}</span>
          {isDirty && (
            <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
              Modified
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
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
              onClick={() => setSearchVisible(!searchVisible)}
              title="Search in file (⌘F)"
              className={searchVisible ? 'bg-accent' : ''}
            >
              <Search className="size-4" />
            </Button>
          )}
          {/* Undo/Redo */}
          {!content?.isBinary && content?.content !== null && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
              >
                <Undo className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (⌘⇧Z)"
              >
                <Redo className="size-4" />
              </Button>
            </>
          )}
          {/* Save */}
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
          {/* File size */}
          {content && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(content.size)}
            </span>
          )}
          {/* Copy */}
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
                if (e.shiftKey) {
                  handlePrevMatch();
                } else {
                  handleNextMatch();
                }
              } else if (e.key === 'Escape') {
                closeSearch();
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
                title="Previous (⇧Enter)"
              >
                <span className="text-xs">↑</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleNextMatch}
                disabled={totalMatches === 0}
                title="Next (Enter)"
              >
                <span className="text-xs">↓</span>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={closeSearch}
            title="Close (Esc)"
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
              <CodeEditorWithInlineEdit
                value={editedContent}
                onChange={handleContentChange}
                language={content.language}
                className="h-full"
                editorPosition={editorPosition}
                focusOnNavigate={!searchVisible}
                filePath={filePath}
                basePath={activeProject?.path}
                enableDefinitions={true}
                enableInlineEdit={true}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
