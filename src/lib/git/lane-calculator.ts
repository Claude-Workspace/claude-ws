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

const COLOR_SCHEME = {
  main: '#f59e0b',     // amber (main/master priority)
  master: '#f59e0b',
  palette: [
    '#3b82f6',  // blue
    '#22c55e',  // green
    '#a855f7',  // purple
    '#ec4899',  // pink
    '#06b6d4',  // cyan
    '#f97316',  // orange
    '#6366f1',  // indigo
  ],
  orphan: '#6b7280',   // gray (commits with no refs/parents)
};

/**
 * Get branch color with main/master priority
 */
function getBranchColor(branchName: string): string {
  // Clean branch name (remove origin/ prefix, HEAD -> prefix)
  const cleanName = branchName.replace(/^origin\//, '').replace(/^HEAD -> /, '');

  // Priority: main/master branches
  if (cleanName === 'main' || cleanName === 'master') {
    return COLOR_SCHEME.main;
  }

  // Hash to palette color
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = ((hash << 5) - hash) + cleanName.charCodeAt(i);
  }
  return COLOR_SCHEME.palette[Math.abs(hash) % COLOR_SCHEME.palette.length];
}

/**
 * Assign color to commit based on refs, parents, or lane
 */
function assignCommitColor(
  commit: GitCommit,
  lane: number,
  commitColors: Map<string, string>
): string {
  // Already has color? Return it
  if (commitColors.has(commit.hash)) {
    return commitColors.get(commit.hash)!;
  }

  // Priority 1: Branch refs
  if (commit.refs.length > 0) {
    // Check for main/master first
    const mainRef = commit.refs.find(ref =>
      ref.includes('main') || ref.includes('master')
    );
    if (mainRef) {
      return COLOR_SCHEME.main;
    }
    return getBranchColor(commit.refs[0]);
  }

  // Orphan commits (no refs, no parents) = gray
  if (commit.refs.length === 0 && commit.parents.length === 0) {
    return COLOR_SCHEME.orphan;
  }

  // Priority 2: Parent color inheritance
  if (commit.parents.length > 0 && commitColors.has(commit.parents[0])) {
    return commitColors.get(commit.parents[0])!;
  }

  // Priority 3: Lane-based fallback
  return COLOR_SCHEME.palette[lane % COLOR_SCHEME.palette.length];
}

/**
 * Calculate lane assignments for commits
 */
export function calculateLanes(commits: GitCommit[]): GraphData {
  const laneAssignments: LaneAssignment[] = [];
  const activeLanes: (string | null)[] = []; // Track expected commits per lane
  const commitColors: Map<string, string> = new Map(); // Track color per commit

  // Pre-populate colors from refs so descendants can correctly inherit them
  for (const commit of commits) {
    if (commit.refs.length > 0) {
      // Check for main/master first
      const mainRef = commit.refs.find(ref =>
        ref.includes('main') || ref.includes('master')
      );
      if (mainRef) {
        commitColors.set(commit.hash, COLOR_SCHEME.main);
      } else {
        commitColors.set(commit.hash, getBranchColor(commit.refs[0]));
      }
    }
  }

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];

    // Find lane expecting this commit
    let lane = activeLanes.indexOf(commit.hash);

    if (lane === -1) {
      // Not expected - find first free lane, max 4 lanes (expandable)
      lane = activeLanes.findIndex(h => h === null);
      if (lane === -1) {
        lane = activeLanes.length < 4 ? activeLanes.length : 0;
      }
    }

    // Assign color based on branch refs, not lane
    // Override propagated color if this commit has its own refs
    let color = commitColors.get(commit.hash);
    if (!color || commit.refs.length > 0) {
      color = assignCommitColor(commit, lane, commitColors);
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
      
      // Only propagate color to parent if it doesn't have one yet
      if (!commitColors.has(commit.parents[0])) {
        commitColors.set(commit.parents[0], color);
      }

      // Additional parents - assign to available lanes
      for (let p = 1; p < commit.parents.length; p++) {
        const parentLane = p < 4 ? p : (lane === 0 ? 1 : 0);
        activeLanes[parentLane] = commit.parents[p];

        // Assign different color for merge parent if it doesn't have one
        if (!commitColors.has(commit.parents[p])) {
          const parentColor = COLOR_SCHEME.palette[(lane + p) % COLOR_SCHEME.palette.length];
          commitColors.set(commit.parents[p], parentColor);
        }
      }
    } else {
      activeLanes[lane] = null;
    }
  }

  const maxLane = laneAssignments.length > 0
    ? Math.max(...laneAssignments.map(a => a.lane))
    : 0;

  return {
    lanes: laneAssignments,
    maxLane,
    colorMap: new Map([[0, COLOR_SCHEME.main], [1, COLOR_SCHEME.palette[0]]]),
  };
}

export { COLOR_SCHEME };
