'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, RefreshCw, GitBranch, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitSection } from './git-section';
import { useProjectStore } from '@/stores/project-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import type { GitStatus, GitFileStatus } from '@/types';

export function GitPanel() {
  const { currentProject } = useProjectStore();
  const { setDiffFile } = useSidebarStore();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!currentProject?.path) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/git/status?path=${encodeURIComponent(currentProject.path)}`
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
  }, [currentProject?.path]);

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
    if (!currentProject?.path) return;
    try {
      await fetch('/api/git/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: currentProject.path, files: [filePath] }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to stage file:', err);
    }
  }, [currentProject?.path, fetchStatus]);

  const unstageFile = useCallback(async (filePath: string) => {
    if (!currentProject?.path) return;
    try {
      await fetch('/api/git/stage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: currentProject.path, files: [filePath] }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to unstage file:', err);
    }
  }, [currentProject?.path, fetchStatus]);

  const discardFile = useCallback(async (filePath: string) => {
    if (!currentProject?.path) return;
    if (!confirm(`Discard changes to ${filePath}?`)) return;
    try {
      await fetch('/api/git/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: currentProject.path, files: [filePath] }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to discard file:', err);
    }
  }, [currentProject?.path, fetchStatus]);

  const stageAll = useCallback(async () => {
    if (!currentProject?.path) return;
    try {
      await fetch('/api/git/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: currentProject.path, all: true }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to stage all:', err);
    }
  }, [currentProject?.path, fetchStatus]);

  const unstageAll = useCallback(async () => {
    if (!currentProject?.path) return;
    try {
      await fetch('/api/git/stage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: currentProject.path, all: true }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to unstage all:', err);
    }
  }, [currentProject?.path, fetchStatus]);

  const discardAll = useCallback(async () => {
    if (!currentProject?.path) return;
    if (!confirm('Discard ALL changes? This cannot be undone!')) return;
    try {
      await fetch('/api/git/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: currentProject.path, all: true }),
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to discard all:', err);
    }
  }, [currentProject?.path, fetchStatus]);

  const handleCommit = useCallback(async () => {
    if (!currentProject?.path || !commitMessage.trim()) return;
    setCommitting(true);
    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: currentProject.path, message: commitMessage }),
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
  }, [currentProject?.path, commitMessage, fetchStatus]);

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

  if (!currentProject) {
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
        {lastUpdated && (
          <p className="text-[10px] text-muted-foreground">
            {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Commit message input */}
      <div className="p-2 border-b">
        <div className="flex gap-1.5">
          <textarea
            className="flex-1 min-h-[60px] px-2 py-1.5 text-sm bg-muted/50 border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Commit message"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canCommit) {
                handleCommit();
              }
            }}
          />
        </div>
        <Button
          className="w-full mt-1.5"
          size="sm"
          disabled={!canCommit || committing}
          onClick={handleCommit}
        >
          {committing ? (
            <Loader2 className="size-4 animate-spin mr-1.5" />
          ) : (
            <Check className="size-4 mr-1.5" />
          )}
          Commit
        </Button>
      </div>

      {/* File sections */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {totalChanges === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
              <p>No changes</p>
              <p className="text-xs mt-1">Working tree clean</p>
            </div>
          ) : (
            <>
              {/* Staged Changes */}
              <GitSection
                title="Staged Changes"
                files={status?.staged || []}
                selectedFile={selectedFile}
                onFileClick={handleFileClick}
                staged={true}
                onUnstageFile={unstageFile}
                onUnstageAll={unstageAll}
              />
              {/* Changes (unstaged + untracked) */}
              <GitSection
                title="Changes"
                files={changes}
                selectedFile={selectedFile}
                onFileClick={handleFileClick}
                staged={false}
                onStageFile={stageFile}
                onStageAll={stageAll}
                onDiscardFile={discardFile}
                onDiscardAll={discardAll}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
