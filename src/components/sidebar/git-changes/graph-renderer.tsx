'use client';

/**
 * Graph Renderer Component
 * Renders SVG visualization for git graph
 */

import { LaneAssignment } from '@/lib/git/lane-calculator';
import { PathSegment, GRAPH_CONSTANTS } from '@/lib/git/path-generator';
import { cn } from '@/lib/utils';

const { LANE_WIDTH, ROW_HEIGHT, DOT_RADIUS } = GRAPH_CONSTANTS;

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

interface GraphRendererProps {
  lanes: LaneAssignment[];
  paths: PathSegment[];
  maxLane: number;
  highlightedCommit?: string;
  onCommitClick?: (hash: string) => void;
  commits?: GitCommit[]; // New: for rendering branch badges
  allRemoteBranches?: string[]; // All remote branches like ['origin/dev', 'origin/main']
}

interface RemoteBranch {
  name: string;
  remote: string;
}

// Parse refs to extract branch/tag names
function parseRefs(refs: string[], allRemoteBranches: string[] = []): {
  localBranches: string[];
  remoteBranches: RemoteBranch[];
  tags: string[];
  isHead: boolean;
} {
  const localBranches: string[] = [];
  const remoteBranches: RemoteBranch[] = [];
  const tags: string[] = [];
  let isHead = false;

  // Create a Set of remote branch names for quick lookup
  const remoteBranchSet = new Set(
    allRemoteBranches.map(ref => {
      const parts = ref.split('/');
      return parts[parts.length - 1]; // Extract branch name from 'origin/dev'
    })
  );

  for (const ref of refs) {
    if (ref.startsWith('HEAD -> ')) {
      const branch = ref.replace('HEAD -> ', '');
      localBranches.push(branch);
      isHead = true;
    } else if (ref.startsWith('tag: ')) {
      tags.push(ref.replace('tag: ', ''));
    } else if (ref.includes('/')) {
      // Remote branch like origin/main or origin/dev
      const parts = ref.split('/');
      const branchName = parts[parts.length - 1];
      const remoteName = parts.slice(0, -1).join('/');
      remoteBranches.push({ name: branchName, remote: remoteName });
    } else {
      // Local branch
      localBranches.push(ref);
    }
  }

  // If we have local branches but no remote branches in refs,
  // check if corresponding remote branches exist
  if (localBranches.length > 0 && remoteBranches.length === 0 && allRemoteBranches.length > 0) {
    for (const localBranch of localBranches) {
      if (remoteBranchSet.has(localBranch)) {
        // Find the full remote ref
        const fullRemoteRef = allRemoteBranches.find(ref => ref.endsWith(`/${localBranch}`));
        if (fullRemoteRef) {
          const parts = fullRemoteRef.split('/');
          const remoteName = parts.slice(0, -1).join('/');
          remoteBranches.push({ name: localBranch, remote: remoteName });
        }
      }
    }
  }

  return {
    localBranches: [...new Set(localBranches)],
    remoteBranches: remoteBranches,
    tags: [...new Set(tags)],
    isHead,
  };
}

export function GraphRenderer({
  lanes,
  paths,
  maxLane,
  highlightedCommit,
  onCommitClick,
  commits = [],
  allRemoteBranches = [],
}: GraphRendererProps) {
  const offsetX = 6; // Reduced offset for more compact layout
  const width = (maxLane + 1) * LANE_WIDTH + offsetX + 150; // Extra space for branch badges
  const height = lanes.length * ROW_HEIGHT;

  return (
    <svg
      width={width}
      height={height}
      className="shrink-0"
      style={{ minWidth: width }}
    >
      {/* Render paths first (below dots) */}
      {paths.map((path, idx) => {
        // Parse and adjust path coordinates
        let d = path.d;

        // Replace M (move), L (line), C (curve) X coordinates
        d = d.replace(/M ([\d.]+) ([\d.]+)/g, (_, x, y) => `M ${parseFloat(x) + offsetX} ${y}`);
        d = d.replace(/L ([\d.]+) ([\d.]+)/g, (_, x, y) => `L ${parseFloat(x) + offsetX} ${y}`);
        d = d.replace(/C ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+)/g,
          (_, x1, y1, x2, y2, x3, y3) =>
            `C ${parseFloat(x1) + offsetX} ${y1}, ${parseFloat(x2) + offsetX} ${y2}, ${parseFloat(x3) + offsetX} ${y3}`
        );

        return (
          <path
            key={`path-${idx}`}
            d={d}
            stroke={path.color}
            strokeWidth={2}
            fill="none"
            opacity={1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}

      {/* Render commit dots and inline branch badges */}
      {lanes.map((lane, idx) => {
        const isHighlighted = lane.commitHash === highlightedCommit;
        const commit = commits[idx];
        const { localBranches, remoteBranches, tags, isHead } = commit ? parseRefs(commit.refs, allRemoteBranches) : {
          localBranches: [],
          remoteBranches: [],
          tags: [],
          isHead: false
        };
        const dotX = lane.lane * LANE_WIDTH + offsetX;
        const dotY = idx * ROW_HEIGHT + ROW_HEIGHT / 2;

        // Calculate badge position (right of dot with small gap)
        const badgeX = dotX + DOT_RADIUS + 8;
        const badgeY = dotY;

        return (
          <g key={lane.commitHash}>
            {/* Outer circle (border) */}
            <circle
              cx={dotX}
              cy={dotY}
              r={DOT_RADIUS}
              fill={lane.color}
              stroke="rgba(0,0,0,0.15)"
              strokeWidth={1}
              className="cursor-pointer transition-all"
              onClick={() => onCommitClick?.(lane.commitHash)}
            />
            {/* Inner highlight circle */}
            {isHighlighted && (
              <circle
                cx={dotX}
                cy={dotY}
                r={DOT_RADIUS + 2}
                fill="none"
                stroke="#fff"
                strokeWidth={2}
                className="animate-pulse"
              />
            )}

            {/* Branch badges inline with dot */}
            {(localBranches.length > 0 || remoteBranches.length > 0 || tags.length > 0) && (
              <foreignObject
                x={badgeX}
                y={badgeY - 10}
                width={180}
                height={20}
                className="overflow-visible"
              >
                <div className="flex items-center gap-1" style={{ fontSize: '10px' }}>
                  {/* Local branches - show first */}
                  {localBranches.slice(0, 2).map((branch) => (
                    <span
                      key={`local-${branch}`}
                      className={cn(
                        'px-1 py-0.5 rounded shrink-0 leading-none font-medium',
                        'bg-green-500/20 text-green-400 border border-green-500/30'
                      )}
                      style={{ fontSize: '10px' }}
                      title={`Local branch: ${branch}${isHead && branch === localBranches[0] ? ' (HEAD)' : ''}`}
                    >
                      {branch.length > 10 ? branch.slice(0, 10) + '...' : branch}
                    </span>
                  ))}

                  {/* Remote branches - show with remote prefix */}
                  {remoteBranches.slice(0, 2).map((remoteBranch: any) => (
                    <span
                      key={`remote-${remoteBranch.name}-${remoteBranch.remote}`}
                      className={cn(
                        'px-1 py-0.5 rounded shrink-0 leading-none font-medium',
                        'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      )}
                      style={{ fontSize: '10px' }}
                      title={`Remote branch: ${remoteBranch.remote}/${remoteBranch.name}`}
                    >
                      {remoteBranch.name.length > 8 ? remoteBranch.name.slice(0, 8) + '...' : remoteBranch.name}
                      <span className="text-[8px] ml-0.5 opacity-70">🌐</span>
                    </span>
                  ))}

                  {/* Tags */}
                  {tags.slice(0, 1).map((tag) => (
                    <span
                      key={tag}
                      className="px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400 shrink-0 leading-none font-medium"
                      style={{ fontSize: '10px' }}
                    >
                      {tag.length > 8 ? tag.slice(0, 8) + '...' : tag}
                    </span>
                  ))}

                  {/* Overflow indicator */}
                  {localBranches.length + remoteBranches.length + tags.length > 4 && (
                    <span
                      className="text-muted-foreground/50 text-[9px]"
                      title={`${localBranches.length + remoteBranches.length + tags.length - 4} more`}
                    >
                      +{localBranches.length + remoteBranches.length + tags.length - 4}
                    </span>
                  )}
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
}
