/**
 * Diff Generator - Line-by-line diff computation for inline code editing
 *
 * Uses the 'diff' package to compute diffs between original and generated code.
 * Outputs structured diff data suitable for CodeMirror decorations.
 */

import * as Diff from 'diff';

/**
 * Represents a single line in the diff output
 */
export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  originalLineNumber: number | null;
  newLineNumber: number | null;
}

/**
 * Represents the complete diff result
 */
export interface DiffResult {
  lines: DiffLine[];
  hasChanges: boolean;
  addedCount: number;
  removedCount: number;
}

/**
 * Generate a line-by-line diff between original and new code
 *
 * @param originalCode - The original code before editing
 * @param newCode - The generated/modified code
 * @returns DiffResult with structured line data
 */
export function generateLineDiff(originalCode: string, newCode: string): DiffResult {
  const changes = Diff.diffLines(originalCode, newCode);

  const lines: DiffLine[] = [];
  let originalLineNumber = 1;
  let newLineNumber = 1;
  let addedCount = 0;
  let removedCount = 0;

  for (const change of changes) {
    const changeLines = change.value.split('\n');
    // Remove last empty line from split (if value ends with \n)
    if (changeLines[changeLines.length - 1] === '') {
      changeLines.pop();
    }

    for (const line of changeLines) {
      if (change.added) {
        lines.push({
          type: 'added',
          content: line,
          originalLineNumber: null,
          newLineNumber: newLineNumber++,
        });
        addedCount++;
      } else if (change.removed) {
        lines.push({
          type: 'removed',
          content: line,
          originalLineNumber: originalLineNumber++,
          newLineNumber: null,
        });
        removedCount++;
      } else {
        lines.push({
          type: 'unchanged',
          content: line,
          originalLineNumber: originalLineNumber++,
          newLineNumber: newLineNumber++,
        });
      }
    }
  }

  return {
    lines,
    hasChanges: addedCount > 0 || removedCount > 0,
    addedCount,
    removedCount,
  };
}

/**
 * Generate a character-level diff for a single line
 * Useful for highlighting specific changes within a line
 *
 * @param originalLine - Original line content
 * @param newLine - New line content
 * @returns Array of character changes
 */
export interface CharChange {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export function generateCharDiff(originalLine: string, newLine: string): CharChange[] {
  const changes = Diff.diffChars(originalLine, newLine);
  return changes.map((change) => ({
    type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
    value: change.value,
  }));
}

/**
 * Apply a diff to the original code to produce the new code
 * Used to reconstruct generated code from diff data
 *
 * @param originalCode - Original code
 * @param diff - Diff result from generateLineDiff
 * @returns The new code after applying the diff
 */
export function applyDiff(originalCode: string, diff: DiffResult): string {
  const newLines: string[] = [];

  for (const line of diff.lines) {
    if (line.type === 'added' || line.type === 'unchanged') {
      newLines.push(line.content);
    }
    // removed lines are skipped
  }

  return newLines.join('\n');
}

/**
 * Get code ranges for decorations based on diff
 * Used by CodeMirror extension to highlight changes
 *
 * @param startPos - Starting position in document
 * @param diff - Diff result
 * @returns Array of decoration ranges
 */
export interface DecorationRange {
  from: number;
  to: number;
  type: 'added' | 'removed';
}

export function getDecorationRanges(
  startPos: number,
  originalLines: string[],
  diff: DiffResult
): DecorationRange[] {
  const ranges: DecorationRange[] = [];
  let currentPos = startPos;

  // Build a map of original line positions
  const originalLinePositions: number[] = [];
  let pos = startPos;
  for (const line of originalLines) {
    originalLinePositions.push(pos);
    pos += line.length + 1; // +1 for newline
  }

  let originalLineIndex = 0;

  for (const line of diff.lines) {
    if (line.type === 'removed') {
      const lineStart = originalLinePositions[originalLineIndex] ?? currentPos;
      const lineEnd = lineStart + line.content.length;
      ranges.push({ from: lineStart, to: lineEnd, type: 'removed' });
      originalLineIndex++;
    } else if (line.type === 'added') {
      // Added lines will be computed based on where they'll be inserted
      ranges.push({ from: currentPos, to: currentPos + line.content.length, type: 'added' });
      currentPos += line.content.length + 1;
    } else {
      // Unchanged - advance both counters
      originalLineIndex++;
      currentPos += line.content.length + 1;
    }
  }

  return ranges;
}
