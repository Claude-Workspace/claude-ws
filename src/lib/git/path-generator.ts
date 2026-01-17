/**
 * SVG Path Generator for Git Graph
 * Creates SVG path strings for connecting commits with curves
 */

import { LaneAssignment, GitCommit } from './lane-calculator';

// Layout constants - Mermaid.js style
const LANE_WIDTH = 20;      // Horizontal spacing between lanes
const ROW_HEIGHT = 28;      // Vertical spacing between commits
const DOT_RADIUS = 5;       // Commit dot size (larger for visibility)
const CURVE_CONTROL = 0.4;  // Bézier curve control point ratio

export interface PathSegment {
  d: string;          // SVG path data
  color: string;      // Stroke color
  type: 'line' | 'merge' | 'branch';
}

/**
 * Create curved merge path from parent lane to commit lane
 */
function createMergePath(
  fromLane: number,
  toLane: number,
  fromY: number,
  toY: number,
  color: string
): PathSegment {
  const x1 = fromLane * LANE_WIDTH;
  const x2 = toLane * LANE_WIDTH;
  const controlY = fromY + (toY - fromY) * CURVE_CONTROL;

  return {
    d: `M ${x1} ${fromY} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${toY}`,
    color,
    type: 'merge',
  };
}

/**
 * Generate SVG paths for all commit connections
 */
export function generatePaths(
  lanes: LaneAssignment[],
  commits: GitCommit[]
): PathSegment[] {
  const paths: PathSegment[] = [];

  for (let i = 0; i < lanes.length; i++) {
    const current = lanes[i];
    const currentCommit = commits[i];
    const currentY = i * ROW_HEIGHT + ROW_HEIGHT / 2; // Center of row

    // Draw lines to parent commits
    for (const parentHash of currentCommit.parents) {
      // Find parent commit index
      const parentIndex = commits.findIndex(c => c.hash === parentHash);
      if (parentIndex === -1) continue; // Parent not in visible range

      const parentLane = lanes[parentIndex];
      const parentY = parentIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

      if (current.lane === parentLane.lane) {
        // Straight line to parent in same lane
        paths.push({
          d: `M ${current.lane * LANE_WIDTH} ${currentY} L ${current.lane * LANE_WIDTH} ${parentY}`,
          color: current.color,
          type: 'line',
        });
      } else {
        // Curved merge line to parent in different lane
        paths.push(createMergePath(
          current.lane,
          parentLane.lane,
          currentY,
          parentY,
          current.color
        ));
      }
    }
  }

  return paths;
}

/**
 * Export layout constants for use in components
 */
export const GRAPH_CONSTANTS = {
  LANE_WIDTH,
  ROW_HEIGHT,
  DOT_RADIUS,
  CURVE_CONTROL,
};
