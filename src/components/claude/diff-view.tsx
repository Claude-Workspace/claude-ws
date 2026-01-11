'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface DiffViewProps {
  oldText: string;
  newText: string;
  filePath?: string;
  className?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

// Simple diff algorithm for showing changes
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  // Find longest common subsequence to identify unchanged lines
  const lcs = findLCS(oldLines, newLines);

  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
      // Context line (unchanged)
      if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        result.push({
          type: 'context',
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
          newLineNum: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else {
        // New line added before this context
        result.push({
          type: 'added',
          content: newLines[newIdx],
          newLineNum: newIdx + 1,
        });
        newIdx++;
      }
    } else if (oldIdx < oldLines.length && (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])) {
      // Line removed
      result.push({
        type: 'removed',
        content: oldLines[oldIdx],
        oldLineNum: oldIdx + 1,
      });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      // Line added
      result.push({
        type: 'added',
        content: newLines[newIdx],
        newLineNum: newIdx + 1,
      });
      newIdx++;
    }
  }

  return result;
}

// Find longest common subsequence
function findLCS(a: string[], b: string[]): string[] {
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

  // Backtrack to find the LCS
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

export function DiffView({ oldText, newText, filePath, className }: DiffViewProps) {
  const diffLines = useMemo(() => computeDiff(oldText, newText), [oldText, newText]);

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length;
    const removed = diffLines.filter(l => l.type === 'removed').length;
    return { added, removed };
  }, [diffLines]);

  return (
    <div className={cn('rounded-md border border-border overflow-hidden text-xs font-mono', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
        <span className="text-muted-foreground truncate">{filePath || 'changes'}</span>
        <div className="flex items-center gap-2 text-[11px]">
          {stats.added > 0 && (
            <span className="text-green-600 dark:text-green-400">+{stats.added}</span>
          )}
          {stats.removed > 0 && (
            <span className="text-red-600 dark:text-red-400">-{stats.removed}</span>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto max-h-64">
        <table className="w-full border-collapse">
          <tbody>
            {diffLines.map((line, idx) => (
              <tr
                key={idx}
                className={cn(
                  line.type === 'added' && 'bg-green-500/10',
                  line.type === 'removed' && 'bg-red-500/10'
                )}
              >
                {/* Line numbers */}
                <td className="select-none text-right px-2 py-0 text-muted-foreground/50 border-r border-border/30 w-8 align-top">
                  {line.oldLineNum || ''}
                </td>
                <td className="select-none text-right px-2 py-0 text-muted-foreground/50 border-r border-border/30 w-8 align-top">
                  {line.newLineNum || ''}
                </td>

                {/* Change indicator */}
                <td className={cn(
                  'select-none px-1 py-0 w-4 text-center align-top',
                  line.type === 'added' && 'text-green-600 dark:text-green-400',
                  line.type === 'removed' && 'text-red-600 dark:text-red-400'
                )}>
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </td>

                {/* Content */}
                <td className={cn(
                  'px-2 py-0 whitespace-pre',
                  line.type === 'added' && 'text-green-700 dark:text-green-300',
                  line.type === 'removed' && 'text-red-700 dark:text-red-300'
                )}>
                  {line.content || '\u00A0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
