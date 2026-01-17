'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown, RefreshCw, Loader2, ArrowUpFromLine, ArrowDownToLine, RotateCcw, MoreHorizontal } from 'lucide-react';
import { GitCommitItem } from './git-commit-item';
import { GraphRenderer } from './graph-renderer';
import { CommitDetailsModal } from './commit-details-modal';
import { useActiveProject } from '@/hooks/use-active-project';
import { cn } from '@/lib/utils';
import { calculateLanes } from '@/lib/git/lane-calculator';
import { generatePaths, GRAPH_CONSTANTS } from '@/lib/git/path-generator';

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  refs: string[];
  isLocal?: boolean;
  isMerge?: boolean;
}

export function GitGraph() {
  const activeProject = useActiveProject();
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [head, setHead] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchLog = useCallback(async () => {
    if (!activeProject?.path) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/git/log?path=${encodeURIComponent(activeProject.path)}&limit=30`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch git log');
      }
      const data = await res.json();
      setCommits(data.commits || []);
      setHead(data.head || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [activeProject?.path]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Calculate graph data when commits change
  const graphData = useMemo(() => {
    if (commits.length === 0) return null;

    const laneData = calculateLanes(commits);
    const paths = generatePaths(laneData.lanes, commits);

    return {
      lanes: laneData.lanes,
      paths,
      maxLane: laneData.maxLane,
    };
  }, [commits]);

  // Git remote operations
  const gitAction = useCallback(async (action: 'fetch' | 'pull' | 'push') => {
    if (!activeProject?.path) return;
    setActionLoading(action);
    try {
      const res = await fetch(`/api/git/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: activeProject.path }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action}`);
      }
      fetchLog(); // Refresh after action
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  }, [activeProject?.path, fetchLog]);

  if (!activeProject) return null;

  return (
    <div className="mb-1">
      {/* Section header */}
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
          'hover:bg-accent/30 transition-colors rounded-sm cursor-pointer'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        <span className="flex-1">Graph</span>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Fetch */}
          <button
            className="p-0.5 hover:bg-accent rounded"
            onClick={(e) => {
              e.stopPropagation();
              gitAction('fetch');
            }}
            disabled={actionLoading !== null}
            title="Fetch"
          >
            <ArrowDownToLine className={cn('size-3.5', actionLoading === 'fetch' && 'animate-pulse')} />
          </button>
          {/* Pull */}
          <button
            className="p-0.5 hover:bg-accent rounded"
            onClick={(e) => {
              e.stopPropagation();
              gitAction('pull');
            }}
            disabled={actionLoading !== null}
            title="Pull"
          >
            <RotateCcw className={cn('size-3.5', actionLoading === 'pull' && 'animate-spin')} />
          </button>
          {/* Push */}
          <button
            className="p-0.5 hover:bg-accent rounded"
            onClick={(e) => {
              e.stopPropagation();
              gitAction('push');
            }}
            disabled={actionLoading !== null}
            title="Push"
          >
            <ArrowUpFromLine className={cn('size-3.5', actionLoading === 'push' && 'animate-pulse')} />
          </button>
          {/* Refresh */}
          <button
            className="p-0.5 hover:bg-accent rounded"
            onClick={(e) => {
              e.stopPropagation();
              fetchLog();
            }}
            title="Refresh"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </button>
          {/* More options */}
          <button
            className="p-0.5 hover:bg-accent rounded"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Show dropdown menu with more options
            }}
            title="More Options"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </div>

        {/* Commit count badge */}
        <span className="px-1.5 py-0.5 bg-muted/80 rounded text-[10px] font-semibold ml-1">
          {commits.length}
        </span>
      </div>

      {/* Commit list */}
      {isExpanded && (
        <div className="mt-0.5">
          {loading && commits.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="px-2 py-2 text-xs text-destructive">{error}</div>
          ) : commits.length === 0 ? (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
              No commits yet
            </div>
          ) : graphData ? (
            <div className="relative pl-2">
              {/* Render SVG graph overlay */}
              <div className="absolute left-2 top-0 z-0">
                <GraphRenderer
                  lanes={graphData.lanes}
                  paths={graphData.paths}
                  maxLane={graphData.maxLane}
                  highlightedCommit={hoveredCommit || undefined}
                  onCommitClick={(hash) => {
                    setSelectedCommit(hash);
                    setModalOpen(true);
                  }}
                />
              </div>

              {/* Render commit items */}
              <div className="relative z-10">
                {commits.map((commit, index) => {
                  const lane = graphData.lanes[index];

                  return (
                    <div
                      key={commit.hash}
                      className="flex items-center"
                      style={{ height: `${GRAPH_CONSTANTS.ROW_HEIGHT}px` }}
                      onMouseEnter={() => setHoveredCommit(commit.hash)}
                      onMouseLeave={() => setHoveredCommit(null)}
                    >
                      {/* Commit info with dynamic margin based on lane */}
                      <div style={{ marginLeft: `${lane.lane * GRAPH_CONSTANTS.LANE_WIDTH + 16}px` }} className="flex-1 min-w-0">
                        <GitCommitItem
                          commit={commit}
                          isHead={commit.hash === head}
                          color={lane.color}
                          isMerge={commit.parents.length > 1}
                          showLine={false}
                          onClick={() => {
                            setSelectedCommit(commit.hash);
                            setModalOpen(true);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Commit Details Modal */}
      <CommitDetailsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        commitHash={selectedCommit}
        projectPath={activeProject.path}
      />
    </div>
  );
}
