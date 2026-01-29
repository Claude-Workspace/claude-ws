'use client';

import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ChevronRight, ChevronDown, RefreshCw, Loader2, ArrowUpFromLine, ArrowDownToLine, RotateCcw } from 'lucide-react';
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

export interface GitGraphRef {
  refresh: () => void;
}

export const GitGraph = forwardRef<GitGraphRef>((props, ref) => {
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
  const [filter, setFilter] = useState<'current' | 'all'>('current');

  const fetchLog = useCallback(async () => {
    if (!activeProject?.path) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/git/log?path=${encodeURIComponent(activeProject.path)}&limit=30&filter=${filter}`
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
  }, [activeProject?.path, filter]);

  // Expose refresh function to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchLog,
  }), [fetchLog]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Auto-refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      fetchLog();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
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
        <div className="flex items-center gap-0.5">
          {/* Filter toggle */}
          <button
            className={cn(
              'p-0.5 hover:bg-accent rounded',
              filter === 'current' && 'bg-accent'
            )}
            onClick={(e) => {
              e.stopPropagation();
              setFilter(filter === 'current' ? 'all' : 'current');
            }}
            title={filter === 'current' ? 'Show all branches' : 'Show current branch only'}
          >
            <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
              {filter === 'current' ? (
                <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 1.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z"/>
              ) : (
                <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM3.5 8a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z"/>
              )}
            </svg>
          </button>
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
        </div>
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
            <div className="space-y-0">
              {commits.map((commit, index) => {
                const lane = graphData.lanes[index];
                const offsetX = 6;

                // Find the rightmost lane in this row
                let maxLaneInRow = lane.lane;

                // Check ALL commits to see if any line passes through this row
                commits.forEach((c, idx) => {
                  c.parents.forEach((parentHash) => {
                    const parentIndex = commits.findIndex(p => p.hash === parentHash);
                    if (parentIndex === -1) return;

                    // Check if line from idx to parentIndex passes through current row (index)
                    const minIdx = Math.min(idx, parentIndex);
                    const maxIdx = Math.max(idx, parentIndex);

                    if (index >= minIdx && index <= maxIdx) {
                      // This line passes through current row
                      const commitLane = graphData.lanes[idx].lane;
                      const parentLane = graphData.lanes[parentIndex].lane;

                      // Track the highest lane involved
                      if (commitLane > maxLaneInRow) maxLaneInRow = commitLane;
                      if (parentLane > maxLaneInRow) maxLaneInRow = parentLane;
                    }
                  });
                });

                // Calculate SVG width based on rightmost lane
                const svgWidth = maxLaneInRow * GRAPH_CONSTANTS.LANE_WIDTH + offsetX + GRAPH_CONSTANTS.DOT_RADIUS + 4;

                const isHovered = hoveredCommit === commit.hash;

                return (
                  <div
                    key={commit.hash}
                    className={cn(
                      'flex items-center transition-colors cursor-pointer',
                      isHovered && 'bg-accent/50'
                    )}
                    style={{ minHeight: `${GRAPH_CONSTANTS.ROW_HEIGHT}px` }}
                    onMouseEnter={() => setHoveredCommit(commit.hash)}
                    onMouseLeave={() => setHoveredCommit(null)}
                    onClick={() => {
                      setSelectedCommit(commit.hash);
                      setModalOpen(true);
                    }}
                  >
                    {/* Graph - LEFT side, dynamic width */}
                    <div className="shrink-0 mr-0.5">
                      <svg
                        width={svgWidth}
                        height={GRAPH_CONSTANTS.ROW_HEIGHT}
                        className="overflow-visible"
                      >
                        {/* Render connecting lines */}
                        {graphData.paths
                          .filter((path) => {
                            const rowY = index * GRAPH_CONSTANTS.ROW_HEIGHT + GRAPH_CONSTANTS.ROW_HEIGHT / 2;
                            return path.d.includes(` ${rowY}`) || path.d.includes(`,${rowY}`);
                          })
                          .map((path, pathIdx) => {
                            let d = path.d;
                            const offsetX = 6;
                            const baseY = index * GRAPH_CONSTANTS.ROW_HEIGHT;

                            d = d.replace(/M ([\d.]+) ([\d.]+)/g, (_, x, y) =>
                              `M ${parseFloat(x) + offsetX} ${parseFloat(y) - baseY}`
                            );
                            d = d.replace(/L ([\d.]+) ([\d.]+)/g, (_, x, y) =>
                              `L ${parseFloat(x) + offsetX} ${parseFloat(y) - baseY}`
                            );
                            d = d.replace(/C ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+)/g,
                              (_, x1, y1, x2, y2, x3, y3) =>
                                `C ${parseFloat(x1) + offsetX} ${parseFloat(y1) - baseY}, ${parseFloat(x2) + offsetX} ${parseFloat(y2) - baseY}, ${parseFloat(x3) + offsetX} ${parseFloat(y3) - baseY}`
                            );

                            return (
                              <path
                                key={`path-${pathIdx}`}
                                d={d}
                                stroke={path.color}
                                strokeWidth={2}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            );
                          })}

                        {/* Commit dot */}
                        {(() => {
                          const offsetX = 6;
                          const dotX = lane.lane * GRAPH_CONSTANTS.LANE_WIDTH + offsetX;
                          const dotY = GRAPH_CONSTANTS.ROW_HEIGHT / 2;
                          const isHighlighted = lane.commitHash === hoveredCommit;

                          return (
                            <g>
                              {/* Glow effect on hover */}
                              {isHighlighted && (
                                <circle
                                  cx={dotX}
                                  cy={dotY}
                                  r={GRAPH_CONSTANTS.DOT_RADIUS + 3}
                                  fill={lane.color}
                                  fillOpacity={0.3}
                                  className="animate-pulse"
                                />
                              )}
                              {/* Main dot */}
                              <circle
                                cx={dotX}
                                cy={dotY}
                                r={GRAPH_CONSTANTS.DOT_RADIUS}
                                fill={lane.color}
                                stroke={isHighlighted ? '#fff' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={isHighlighted ? 1.5 : 1}
                                className="cursor-pointer transition-all"
                                onClick={() => {
                                  setSelectedCommit(commit.hash);
                                  setModalOpen(true);
                                }}
                              />
                            </g>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* Commit text - RIGHT side, takes remaining space */}
                    <div className="flex-1 min-w-0">
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
});

GitGraph.displayName = 'GitGraph';
