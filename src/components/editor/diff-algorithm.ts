/**
 * Pure diff computation functions for the file diff resolver.
 * Implements LCS-based diffing to produce structured diff blocks.
 */

export interface DiffBlock {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  localLines: string[];
  remoteLines: string[];
  localStartLine: number;
  remoteStartLine: number;
}

/**
 * Compute structured diff blocks between local and remote content.
 * Uses Longest Common Subsequence (LCS) to identify matching lines,
 * then groups non-matching lines into added/removed/modified blocks.
 */
export function computeDiffBlocks(localContent: string, remoteContent: string): DiffBlock[] {
  const localLines = localContent.split('\n');
  const remoteLines = remoteContent.split('\n');
  const lcs = computeLCS(localLines, remoteLines);
  const blocks: DiffBlock[] = [];

  let localIdx = 0;
  let remoteIdx = 0;
  let lcsIdx = 0;

  while (localIdx < localLines.length || remoteIdx < remoteLines.length) {
    if (lcsIdx < lcs.length) {
      const [lcsLocalIdx, lcsRemoteIdx] = lcs[lcsIdx];

      // Collect lines before the next common line into a diff block
      if (localIdx < lcsLocalIdx || remoteIdx < lcsRemoteIdx) {
        const block = collectDiffLines(localLines, remoteLines, localIdx, remoteIdx, lcsLocalIdx, lcsRemoteIdx);
        if (block) blocks.push(block);
        localIdx = lcsLocalIdx;
        remoteIdx = lcsRemoteIdx;
      }

      // Add the common (unchanged) line
      blocks.push({
        type: 'unchanged',
        localLines: [localLines[localIdx]],
        remoteLines: [remoteLines[remoteIdx]],
        localStartLine: localIdx,
        remoteStartLine: remoteIdx,
      });

      localIdx++;
      remoteIdx++;
      lcsIdx++;
    } else {
      // Handle remaining lines after LCS is exhausted
      const block = collectDiffLines(
        localLines, remoteLines,
        localIdx, remoteIdx,
        localLines.length, remoteLines.length,
      );
      if (block) blocks.push(block);
      break;
    }
  }

  return blocks;
}

/**
 * Collect differing lines between two index ranges and classify them
 * as added, removed, or modified.
 */
function collectDiffLines(
  localLines: string[],
  remoteLines: string[],
  localStart: number,
  remoteStart: number,
  localEnd: number,
  remoteEnd: number,
): DiffBlock | null {
  const removedLines = localLines.slice(localStart, localEnd);
  const addedLines = remoteLines.slice(remoteStart, remoteEnd);

  if (removedLines.length === 0 && addedLines.length === 0) return null;

  let type: DiffBlock['type'];
  if (removedLines.length > 0 && addedLines.length > 0) {
    type = 'modified';
  } else if (removedLines.length > 0) {
    type = 'removed';
  } else {
    type = 'added';
  }

  return {
    type,
    localLines: removedLines,
    remoteLines: addedLines,
    localStartLine: localStart,
    remoteStartLine: remoteStart,
  };
}

/**
 * Compute Longest Common Subsequence index pairs using dynamic programming.
 * Returns array of [localIndex, remoteIndex] tuples for matching lines.
 */
function computeLCS(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the actual LCS indices
  const result: [number, number][] = [];
  let i = m, j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}
