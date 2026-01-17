/**
 * Lane Calculator for Git Graph Visualization
 * Assigns horizontal lane positions to commits based on topology
 */

export interface LaneAssignment {
  commitHash: string;
  lane: number;           // Horizontal position (0, 1, 2...)
  inLanes: number[];      // Parent lanes merging in
  outLanes: number[];     // Child lanes branching out
  color: string;          // Assigned branch color
}

export interface GraphData {
  lanes: LaneAssignment[];
  maxLane: number;        // Total lanes needed
  colorMap: Map<number, string>; // Lane → color mapping
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  refs: string[];
  isLocal?: boolean;   // Not on any remote tracking branch
  isMerge?: boolean;   // Has multiple parents
}

const BRANCH_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
];

/**
 * Hash branch name to consistent color
 */
function hashBranchColor(branchName: string): string {
  let hash = 0;
  for (let i = 0; i < branchName.length; i++) {
    hash = ((hash << 5) - hash) + branchName.charCodeAt(i);
  }
  return BRANCH_COLORS[Math.abs(hash) % BRANCH_COLORS.length];
}

/**
 * Assign stable color based on branch refs or commit properties
 */
function assignColor(
  lane: number,
  commit: GitCommit,
  colorMap: Map<number, string>
): void {
  // Priority: branch refs > deterministic hash
  if (commit.refs.length > 0) {
    const branchName = commit.refs[0];
    colorMap.set(lane, hashBranchColor(branchName));
  } else {
    colorMap.set(lane, BRANCH_COLORS[lane % BRANCH_COLORS.length]);
  }
}

/**
 * Calculate lane assignments for commits
 */
export function calculateLanes(commits: GitCommit[]): GraphData {
  const laneAssignments: LaneAssignment[] = [];
  const activeLanes: (string | null)[] = []; // Track expected commits per lane
  const commitColors: Map<string, string> = new Map(); // Track color per commit

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];

    // Find lane expecting this commit
    let lane = activeLanes.indexOf(commit.hash);

    if (lane === -1) {
      // Not expected - find first free lane, max 2 lanes
      lane = activeLanes.findIndex(h => h === null);
      if (lane === -1) {
        lane = activeLanes.length < 2 ? activeLanes.length : 0;
      }
    }

    // Assign color based on branch refs, not lane
    let color = commitColors.get(commit.hash);
    if (!color) {
      if (commit.refs.length > 0) {
        color = hashBranchColor(commit.refs[0]);
      } else {
        // Use parent's color if available
        if (commit.parents.length > 0) {
          color = commitColors.get(commit.parents[0]) || BRANCH_COLORS[lane % BRANCH_COLORS.length];
        } else {
          color = BRANCH_COLORS[lane % BRANCH_COLORS.length];
        }
      }
      commitColors.set(commit.hash, color);
    }

    const inLanes: number[] = [];
    for (const parentHash of commit.parents) {
      const parentLane = activeLanes.indexOf(parentHash);
      if (parentLane !== -1) {
        inLanes.push(parentLane);
      }
    }

    laneAssignments.push({
      commitHash: commit.hash,
      lane,
      inLanes,
      outLanes: [lane],
      color,
    });

    // Update active lanes and propagate colors
    if (commit.parents.length > 0) {
      activeLanes[lane] = commit.parents[0];
      commitColors.set(commit.parents[0], color);

      // Additional parents - assign to available lanes
      for (let p = 1; p < commit.parents.length; p++) {
        const parentLane = p < 2 ? p : (lane === 0 ? 1 : 0);
        activeLanes[parentLane] = commit.parents[p];

        // Assign different color for merge parent
        const parentColor = BRANCH_COLORS[(lane + p) % BRANCH_COLORS.length];
        commitColors.set(commit.parents[p], parentColor);
      }
    } else {
      activeLanes[lane] = null;
    }
  }

  const maxLane = Math.min(
    laneAssignments.length > 0 ? Math.max(...laneAssignments.map(a => a.lane)) : 0,
    1
  );

  return {
    lanes: laneAssignments,
    maxLane,
    colorMap: new Map([[0, BRANCH_COLORS[0]], [1, BRANCH_COLORS[1]]]),
  };
}
