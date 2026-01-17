'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, RefreshCw, GitBranch, ArrowUp, ArrowDown, Check, ChevronDown, ChevronRight, Plus, Minus, Undo2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitSection } from './git-section';
import { GitGraph } from './git-graph';
import { GitFileItem } from './git-file-item';
import { useActiveProject } from '@/hooks/use-active-project';
import { useSidebarStore } from '@/stores/sidebar-store';
import { cn } from '@/lib/utils';
import type { GitStatus, GitFileStatus } from '@/types';

export function GitPanel() {
  const activeProject = useActiveProject();
  const { setDiffFile } = useSidebarStore();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [stagedExpanded, setStagedExpanded] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!activeProject?.path) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/git/status?path=${encodeURIComponent(activeProject.path)}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch git status');
      }
      const data = await res.json();
      setStatus(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [activeProject?.path]);

  // Fetch on mount and when project changes
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      fetchStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStatus]);

  const handleFileClick = useCallback(
    (path: string, staged: boolean) => {
      setSelectedFile(path);
      setDiffFile(path, staged);
    },
    [setDiffFile]
  );

  // Git operations
  const stageFile = useCallback(async (filePath: string) => {
    if (!activeProject?.path) return;
    try {
      await fetch('/api/git/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeProject.path, files: [filePath] }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to stage file:', err);
    }
  }, [activeProject?.path, fetchStatus]);

  const unstageFile = useCallback(async (filePath: string) => {
    if (!activeProject?.path) return;
    try {
      await fetch('/api/git/stage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeProject.path, files: [filePath] }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to unstage file:', err);
    }
  }, [activeProject?.path, fetchStatus]);

  const discardFile = useCallback(async (filePath: string) => {
    if (!activeProject?.path) return;
    if (!confirm(`Discard changes to ${filePath}?`)) return;
    try {
      await fetch('/api/git/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeProject.path, files: [filePath] }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to discard file:', err);
    }
  }, [activeProject?.path, fetchStatus]);

  const stageAll = useCallback(async () => {
    if (!activeProject?.path) return;
    try {
      await fetch('/api/git/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeProject.path, all: true }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to stage all:', err);
    }
  }, [activeProject?.path, fetchStatus]);

  const unstageAll = useCallback(async () => {
    if (!activeProject?.path) return;
    try {
      await fetch('/api/git/stage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeProject.path, all: true }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to unstage all:', err);
    }
  }, [activeProject?.path, fetchStatus]);

  const discardAll = useCallback(async () => {
    if (!activeProject?.path) return;
    if (!confirm('Discard ALL changes? This cannot be undone!')) return;
    try {
      await fetch('/api/git/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeProject.path, all: true }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to discard all:', err);
    }
  }, [activeProject?.path, fetchStatus]);

  const handleCommit = useCallback(async () => {
    if (!activeProject?.path || !commitMessage.trim()) return;
    setCommitting(true);
    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeProject.path, message: commitMessage }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to commit');
      }
      setCommitMessage('');
      fetchStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to commit');
    } finally {
      setCommitting(false);
    }
  }, [activeProject?.path, commitMessage, fetchStatus]);

  const handleGenerateMessage = useCallback(async () => {
    if (!activeProject?.path) return;

    setGeneratingMessage(true);
    try {
      const res = await fetch('/api/git/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeProject.path }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate message');
      }

      const { message } = await res.json();
      setCommitMessage(message);
    } catch (err) {
      console.error('AI generation error:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate commit message');
    } finally {
      setGeneratingMessage(false);
    }
  }, [activeProject?.path]);

  // Combine unstaged and untracked into single "Changes" section
  const changes: GitFileStatus[] = useMemo(() => {
    if (!status) return [];
    return [...(status.unstaged || []), ...(status.untracked || [])];
  }, [status]);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
        <p className="text-sm text-destructive text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchStatus}>
          Retry
        </Button>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No project selected
      </div>
    );
  }

  const totalChanges = (status?.staged.length || 0) + changes.length;
  const canCommit = (status?.staged.length || 0) > 0 && commitMessage.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header with branch info */}
      <div className="px-2 py-1.5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <GitBranch className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium truncate">
              {status?.branch || 'No branch'}
            </span>
            {status && (status.ahead > 0 || status.behind > 0) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {status.ahead > 0 && (
                  <span className="flex items-center">
                    <ArrowUp className="size-3" />
                    {status.ahead}
                  </span>
                )}
                {status.behind > 0 && (
                  <span className="flex items-center">
                    <ArrowDown className="size-3" />
                    {status.behind}
                  </span>
                )}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={fetchStatus}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* File sections */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* CHANGES section with commit input inside */}
          <div className="mb-1">
            {/* Section header */}
            <div
              className={cn(
                'group flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
                'hover:bg-accent/30 transition-colors rounded-sm cursor-pointer'
              )}
              onClick={() => setChangesExpanded(!changesExpanded)}
            >
              {changesExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <span className="flex-1">Changes</span>

              {/* Section action buttons */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    discardAll();
                  }}
                  title="Discard All Changes"
                >
                  <Undo2 className="size-3.5" />
                </button>
                <button
                  className="p-0.5 hover:bg-accent rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    stageAll();
                  }}
                  title="Stage All Changes"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>

              {/* File count badge */}
              <span className="px-1.5 py-0.5 bg-muted/80 rounded text-[10px] font-semibold ml-1">
                {totalChanges}
              </span>
            </div>

            {/* Changes content - commit input + file lists */}
            {changesExpanded && (
              <div className="mt-0.5">
                {/* Commit message input inside Changes section */}
                <div className="px-2 pb-2">
                  <textarea
                    className="w-full min-h-[60px] px-2 py-1.5 text-sm bg-muted/50 border rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                    placeholder="Commit message"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canCommit) {
                        handleCommit();
                      }
                    }}
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <Button
                      className="flex-[3]"
                      size="sm"
                      disabled={!canCommit || committing}
                      onClick={handleCommit}
                    >
                      {committing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                    </Button>
                    {/* Generate commit message button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-[2]"
                      title={
                        totalChanges === 0
                          ? 'No changes to generate commit message for'
                          : generatingMessage
                          ? 'Generating...'
                          : 'Generate commit message with AI'
                      }
                      onClick={handleGenerateMessage}
                      disabled={generatingMessage || totalChanges === 0}
                    >
                      {generatingMessage ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Image
                          src="/logo.png"
                          alt="Generate"
                          width={16}
                          height={16}
                          className="opacity-80"
                        />
                      )}
                    </Button>
                  </div>
                </div>

                {totalChanges === 0 ? (
                  <div className="flex flex-col items-center justify-center py-4 text-muted-foreground text-sm">
                    <p>No changes</p>
                    <p className="text-xs mt-1">Working tree clean</p>
                  </div>
                ) : (
                  <>
                    {/* Staged Changes subsection */}
                    {(status?.staged.length || 0) > 0 && (
                      <div className="mb-1">
                        <div
                          className={cn(
                            'group flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-muted-foreground',
                            'hover:bg-accent/30 transition-colors rounded-sm cursor-pointer'
                          )}
                          onClick={() => setStagedExpanded(!stagedExpanded)}
                        >
                          {stagedExpanded ? (
                            <ChevronDown className="size-3" />
                          ) : (
                            <ChevronRight className="size-3" />
                          )}
                          <span className="flex-1">Staged</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-0.5 hover:bg-accent rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                unstageAll();
                              }}
                              title="Unstage All"
                            >
                              <Minus className="size-3" />
                            </button>
                          </div>
                          <span className="px-1 py-0.5 bg-muted/80 rounded text-[9px] font-semibold">
                            {status?.staged.length || 0}
                          </span>
                        </div>
                        {stagedExpanded && (
                          <div>
                            {status?.staged.map((file) => (
                              <GitFileItem
                                key={file.path}
                                file={file}
                                isSelected={selectedFile === file.path}
                                staged={true}
                                onClick={() => handleFileClick(file.path, true)}
                                onUnstage={() => unstageFile(file.path)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Unstaged Changes */}
                    {changes.length > 0 && (
                      <div>
                        {changes.map((file) => (
                          <GitFileItem
                            key={file.path}
                            file={file}
                            isSelected={selectedFile === file.path}
                            staged={false}
                            onClick={() => handleFileClick(file.path, false)}
                            onStage={() => stageFile(file.path)}
                            onDiscard={() => discardFile(file.path)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Commit Graph */}
          <GitGraph />
        </div>
      </ScrollArea>
    </div>
  );
}
