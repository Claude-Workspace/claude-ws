'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, GitBranch, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitSection } from './git-section';
import { useProjectStore } from '@/stores/project-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import type { GitStatus } from '@/types';

export function GitPanel() {
  const { currentProject } = useProjectStore();
  const { setDiffFile } = useSidebarStore();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  const totalChanges =
    (status?.staged.length || 0) +
    (status?.unstaged.length || 0) +
    (status?.untracked.length || 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header with branch info */}
      <div className="p-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium truncate">
              {status?.branch || 'No branch'}
            </span>
            {status && (status.ahead > 0 || status.behind > 0) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {status.ahead > 0 && (
                  <span className="flex items-center gap-0.5">
                    <ArrowUp className="size-3" />
                    {status.ahead}
                  </span>
                )}
                {status.behind > 0 && (
                  <span className="flex items-center gap-0.5">
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
            title="Refresh git status"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {lastUpdated && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* File sections */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {totalChanges === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
              <p>No changes</p>
              <p className="text-xs mt-1">Working tree clean</p>
            </div>
          ) : (
            <>
              <GitSection
                title="Staged Changes"
                files={status?.staged || []}
                selectedFile={selectedFile}
                onFileClick={handleFileClick}
                staged={true}
              />
              <GitSection
                title="Changes"
                files={status?.unstaged || []}
                selectedFile={selectedFile}
                onFileClick={handleFileClick}
                staged={false}
              />
              <GitSection
                title="Untracked"
                files={status?.untracked || []}
                selectedFile={selectedFile}
                onFileClick={handleFileClick}
                staged={false}
                defaultExpanded={false}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
