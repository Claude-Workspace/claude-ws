'use client';

/**
 * File Diff Resolver Modal
 *
 * Shows a modal when file changes are detected on disk while the user
 * has unsaved local changes. Displays side-by-side comparison with
 * interactive "Insert" buttons on changed remote lines to merge
 * specific changes into local content.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Copy, ArrowLeft, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FileDiffResolverModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** File path for display */
  filePath: string;
  /** Current local content in the editor */
  localContent: string;
  /** Remote content from disk */
  remoteContent: string;
  /** Callback when user accepts remote content */
  onAcceptRemote: () => void;
  /** Callback when user keeps local content */
  onKeepLocal: () => void;
  /** Callback when user manually merges (passes merged content) */
  onMerge: (mergedContent: string) => void;
}

interface DiffBlock {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  localLines: string[];
  remoteLines: string[];
  localStartLine: number;
  remoteStartLine: number;
}

export function FileDiffResolverModal({
  open,
  onClose,
  filePath,
  localContent,
  remoteContent,
  onAcceptRemote,
  onKeepLocal,
  onMerge,
}: FileDiffResolverModalProps) {
  // Working copy of local content that user can modify via inserts
  const [workingContent, setWorkingContent] = useState(localContent);
  const localScrollRef = useRef<HTMLDivElement>(null);
  const remoteScrollRef = useRef<HTMLDivElement>(null);

  // Reset working content when modal opens with new content
  useEffect(() => {
    if (open) {
      setWorkingContent(localContent);
    }
  }, [open, localContent]);

  // Compute diff blocks between working content and remote
  const diffBlocks = useMemo(() => {
    return computeDiffBlocks(workingContent, remoteContent);
  }, [workingContent, remoteContent]);

  // Check if there are any remaining differences
  const hasChanges = useMemo(() => {
    return diffBlocks.some(block => block.type !== 'unchanged');
  }, [diffBlocks]);

  // Insert a remote line at a specific position in working content
  const handleInsertLine = useCallback((remoteLine: string, insertAfterLocalLine: number) => {
    const lines = workingContent.split('\n');
    // Insert the remote line with >>>>> marker before it
    lines.splice(insertAfterLocalLine, 0, '>>>>> REMOTE', remoteLine);
    setWorkingContent(lines.join('\n'));
    toast.success('Line inserted with marker');
  }, [workingContent]);

  // Insert all lines from a remote block
  const handleInsertBlock = useCallback((remoteLines: string[], insertAfterLocalLine: number) => {
    const lines = workingContent.split('\n');
    // Insert marker before the block and all remote lines
    lines.splice(insertAfterLocalLine, 0, '>>>>> REMOTE', ...remoteLines, '<<<<< END REMOTE');
    setWorkingContent(lines.join('\n'));
    toast.success(`${remoteLines.length} line(s) inserted with markers`);
  }, [workingContent]);

  // Insert deletion marker for lines that exist in local but not remote
  // startPosition is the index where the first deleted line is
  // lineCount is how many lines are being deleted
  const handleInsertDeletedMarker = useCallback((startPosition: number, lineCount: number) => {
    const lines = workingContent.split('\n');

    // Insert end marker AFTER all the deleted lines (at position startPosition + lineCount)
    lines.splice(startPosition + lineCount, 0, '<<<<< END REMOTE DELETED');

    // Insert start marker BEFORE the deleted lines (at position startPosition)
    lines.splice(startPosition, 0, '>>>>> REMOTE DELETED');

    setWorkingContent(lines.join('\n'));
    toast.success(lineCount > 1 ? 'Deletion markers inserted' : 'Deletion marker inserted');
  }, [workingContent]);

  // Handle keeping local (dismiss all remote changes)
  const handleKeepLocal = useCallback(() => {
    onKeepLocal();
    onClose();
    toast.success('Kept local changes');
  }, [onKeepLocal, onClose]);

  // Handle accepting remote entirely
  const handleAcceptRemote = useCallback(() => {
    onAcceptRemote();
    onClose();
    toast.success('Accepted remote changes');
  }, [onAcceptRemote, onClose]);

  // Handle applying the working (merged) content
  const handleApplyMerged = useCallback(() => {
    onMerge(workingContent);
    onClose();
    toast.success('Applied merged changes');
  }, [workingContent, onMerge, onClose]);

  // Copy content to clipboard
  const handleCopy = useCallback(async (content: string, label: string) => {
    await navigator.clipboard.writeText(content);
    toast.success(`Copied ${label} to clipboard`);
  }, []);

  // Sync scroll between panels
  const handleScroll = useCallback((source: 'local' | 'remote') => {
    const sourceRef = source === 'local' ? localScrollRef : remoteScrollRef;
    const targetRef = source === 'local' ? remoteScrollRef : localScrollRef;

    if (sourceRef.current && targetRef.current) {
      targetRef.current.scrollTop = sourceRef.current.scrollTop;
    }
  }, []);

  const fileName = filePath.split('/').pop() || filePath;
  const workingLines = workingContent.split('\n');
  const remoteLines = remoteContent.split('\n');

  // Check if working content differs from original local
  const hasLocalModifications = workingContent !== localContent;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            File Changed Externally
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{fileName}</span>
            {' '}has been modified on disk. Click <Plus className="inline size-3" /> to insert remote lines into your version.
          </DialogDescription>
        </DialogHeader>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Differences:</span>
          {hasChanges ? (
            <>
              <span className="text-blue-600 dark:text-blue-400">
                {diffBlocks.filter(b => b.type === 'added').reduce((sum, b) => sum + b.remoteLines.length, 0)} new in remote
              </span>
              <span className="text-green-600 dark:text-green-400">
                {diffBlocks.filter(b => b.type === 'removed').reduce((sum, b) => sum + b.localLines.length, 0)} only in local
              </span>
            </>
          ) : (
            <span className="text-green-600 dark:text-green-400">✓ Files are identical</span>
          )}
          {hasLocalModifications && (
            <span className="text-amber-600 dark:text-amber-400 ml-auto text-xs">
              • Modified from original
            </span>
          )}
        </div>

        {/* Side-by-side diff view */}
        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
          {/* Local/Working (left) */}
          <div className="flex flex-col border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
              <span className="text-xs font-medium text-muted-foreground">
                Local {hasLocalModifications && '(modified)'}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleCopy(workingContent, 'local content')}
                title="Copy local content"
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <div
              ref={localScrollRef}
              className="flex-1 overflow-auto font-mono text-xs"
              onScroll={() => handleScroll('local')}
            >
              <DiffPanelLocal
                diffBlocks={diffBlocks}
                workingLines={workingLines}
              />
            </div>
          </div>

          {/* Remote (right) */}
          <div className="flex flex-col border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
              <span className="text-xs font-medium text-muted-foreground">Remote (Disk)</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleCopy(remoteContent, 'remote content')}
                title="Copy remote content"
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <div
              ref={remoteScrollRef}
              className="flex-1 overflow-auto font-mono text-xs"
              onScroll={() => handleScroll('remote')}
            >
              <DiffPanelRemote
                diffBlocks={diffBlocks}
                remoteLines={remoteLines}
                onInsertLine={handleInsertLine}
                onInsertBlock={handleInsertBlock}
                onInsertDeletedMarker={handleInsertDeletedMarker}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button
            variant="outline"
            value="keep-local"
            onClick={handleKeepLocal}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Keep Local Only
          </Button>
          <Button
            variant="outline"
            value="accept-remote"
            onClick={handleAcceptRemote}
            className="gap-2"
          >
            Accept Remote Only
          </Button>
          {hasLocalModifications && (
            <Button
              variant="default"
              value="apply-merged"
              onClick={handleApplyMerged}
              className="gap-2"
            >
              <Check className="size-4" />
              Apply Merged
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// === Diff computation ===

function computeDiffBlocks(localContent: string, remoteContent: string): DiffBlock[] {
  const localLines = localContent.split('\n');
  const remoteLines = remoteContent.split('\n');

  // Use a simple LCS-based diff algorithm
  const lcs = computeLCS(localLines, remoteLines);
  const blocks: DiffBlock[] = [];

  let localIdx = 0;
  let remoteIdx = 0;
  let lcsIdx = 0;

  while (localIdx < localLines.length || remoteIdx < remoteLines.length) {
    if (lcsIdx < lcs.length) {
      const [lcsLocalIdx, lcsRemoteIdx] = lcs[lcsIdx];

      // Handle lines before the next common line
      if (localIdx < lcsLocalIdx || remoteIdx < lcsRemoteIdx) {
        const removedLines: string[] = [];
        const addedLines: string[] = [];
        const localStart = localIdx;
        const remoteStart = remoteIdx;

        while (localIdx < lcsLocalIdx) {
          removedLines.push(localLines[localIdx]);
          localIdx++;
        }
        while (remoteIdx < lcsRemoteIdx) {
          addedLines.push(remoteLines[remoteIdx]);
          remoteIdx++;
        }

        if (removedLines.length > 0 && addedLines.length > 0) {
          blocks.push({
            type: 'modified',
            localLines: removedLines,
            remoteLines: addedLines,
            localStartLine: localStart,
            remoteStartLine: remoteStart,
          });
        } else if (removedLines.length > 0) {
          blocks.push({
            type: 'removed',
            localLines: removedLines,
            remoteLines: [],
            localStartLine: localStart,
            remoteStartLine: remoteStart,
          });
        } else if (addedLines.length > 0) {
          blocks.push({
            type: 'added',
            localLines: [],
            remoteLines: addedLines,
            localStartLine: localStart,
            remoteStartLine: remoteStart,
          });
        }
      }

      // Add the common line
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
      // Handle remaining lines after LCS
      const removedLines: string[] = [];
      const addedLines: string[] = [];
      const localStart = localIdx;
      const remoteStart = remoteIdx;

      while (localIdx < localLines.length) {
        removedLines.push(localLines[localIdx]);
        localIdx++;
      }
      while (remoteIdx < remoteLines.length) {
        addedLines.push(remoteLines[remoteIdx]);
        remoteIdx++;
      }

      if (removedLines.length > 0 && addedLines.length > 0) {
        blocks.push({
          type: 'modified',
          localLines: removedLines,
          remoteLines: addedLines,
          localStartLine: localStart,
          remoteStartLine: remoteStart,
        });
      } else if (removedLines.length > 0) {
        blocks.push({
          type: 'removed',
          localLines: removedLines,
          remoteLines: [],
          localStartLine: localStart,
          remoteStartLine: remoteStart,
        });
      } else if (addedLines.length > 0) {
        blocks.push({
          type: 'added',
          localLines: [],
          remoteLines: addedLines,
          localStartLine: localStart,
          remoteStartLine: remoteStart,
        });
      }
    }
  }

  return blocks;
}

// Compute Longest Common Subsequence indices
function computeLCS(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;

  // DP table
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

// === Local Panel (shows working content) ===

interface DiffPanelLocalProps {
  diffBlocks: DiffBlock[];
  workingLines: string[];
}

function DiffPanelLocal({ diffBlocks, workingLines }: DiffPanelLocalProps) {
  let lineNumber = 0;

  return (
    <>
      {diffBlocks.map((block, blockIdx) => {
        const elements: React.ReactNode[] = [];

        if (block.type === 'unchanged') {
          block.localLines.forEach((line, idx) => {
            lineNumber++;
            const isMarkerLine = line.startsWith('>>>>>') || line.startsWith('<<<<<');

            elements.push(
              <div
                key={`${blockIdx}-${idx}`}
                className={cn(
                  "px-2 py-0.5 whitespace-pre-wrap break-all flex",
                  isMarkerLine && "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold"
                )}
              >
                <span className="text-muted-foreground/50 select-none w-8 text-right mr-2 shrink-0">
                  {lineNumber}
                </span>
                <span className="flex-1">{line || '\u00A0'}</span>
              </div>
            );
          });
        } else if (block.type === 'removed' || block.type === 'modified') {
          // Show local-only lines with green background
          block.localLines.forEach((line, idx) => {
            lineNumber++;
            const isMarkerLine = line.startsWith('>>>>>') || line.startsWith('<<<<<');

            elements.push(
              <div
                key={`${blockIdx}-${idx}`}
                className={cn(
                  "px-2 py-0.5 whitespace-pre-wrap break-all flex",
                  isMarkerLine
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold"
                    : "bg-green-500/15"
                )}
              >
                <span className="text-muted-foreground/50 select-none w-8 text-right mr-2 shrink-0">
                  {lineNumber}
                </span>
                <span className="flex-1">{line || '\u00A0'}</span>
              </div>
            );
          });
        } else if (block.type === 'added') {
          // Show placeholder for lines that exist only in remote
          elements.push(
            <div
              key={`${blockIdx}-placeholder`}
              className="px-2 py-0.5 flex bg-blue-500/10 text-muted-foreground/50 italic"
            >
              <span className="w-8 text-right mr-2 shrink-0">+</span>
              <span className="flex-1">{block.remoteLines.length} line(s) in remote</span>
            </div>
          );
        }

        return elements;
      })}
    </>
  );
}

// === Remote Panel (shows remote content with insert buttons) ===

interface DiffPanelRemoteProps {
  diffBlocks: DiffBlock[];
  remoteLines: string[];
  onInsertLine: (line: string, insertAfterLocalLine: number) => void;
  onInsertBlock: (lines: string[], insertAfterLocalLine: number) => void;
  onInsertDeletedMarker: (insertAfterLocalLine: number, lineCount: number) => void;
}

function DiffPanelRemote({ diffBlocks, remoteLines, onInsertLine, onInsertBlock, onInsertDeletedMarker }: DiffPanelRemoteProps) {
  let lineNumber = 0;
  let currentLocalLine = 0;

  return (
    <>
      {diffBlocks.map((block, blockIdx) => {
        const elements: React.ReactNode[] = [];
        const insertPosition = currentLocalLine;

        if (block.type === 'unchanged') {
          block.remoteLines.forEach((line, idx) => {
            lineNumber++;
            currentLocalLine++;
            elements.push(
              <div key={`${blockIdx}-${idx}`} className="px-2 py-0.5 whitespace-pre-wrap break-all flex">
                <span className="text-muted-foreground/50 select-none w-8 text-right mr-2 shrink-0">
                  {lineNumber}
                </span>
                <span className="flex-1">{line || '\u00A0'}</span>
              </div>
            );
          });
        } else if (block.type === 'added' || block.type === 'modified') {
          // Show remote lines - only add individual buttons for single-line blocks
          const isSingleLine = block.remoteLines.length === 1;

          block.remoteLines.forEach((line, idx) => {
            lineNumber++;
            const isMarkerLine = line.startsWith('>>>>>') || line.startsWith('<<<<<');

            elements.push(
              <div
                key={`${blockIdx}-${idx}`}
                className={cn(
                  "group px-2 py-0.5 whitespace-pre-wrap break-all flex",
                  isMarkerLine
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold"
                    : "bg-blue-500/15",
                  !isSingleLine && "hover:bg-blue-500/25"
                )}
              >
                <span className="text-muted-foreground/50 select-none w-8 text-right mr-2 shrink-0">
                  {lineNumber}
                </span>
                <span className="flex-1">{line || '\u00A0'}</span>
                {/* Only show individual button for single-line blocks that aren't markers */}
                {isSingleLine && !isMarkerLine && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 shrink-0 ml-1 h-5 w-5"
                    onClick={() => onInsertLine(line, insertPosition)}
                    title="Insert this line into local"
                  >
                    <Plus className="size-3" />
                  </Button>
                )}
              </div>
            );
          });

          // Add "Insert All" button for multi-line blocks (after all lines)
          if (!isSingleLine) {
            elements.push(
              <div
                key={`${blockIdx}-insert-all`}
                className="px-2 py-1 flex justify-end border-b border-blue-500/20 bg-blue-500/5"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => onInsertBlock(block.remoteLines, insertPosition)}
                >
                  <Plus className="size-3" />
                  Insert all {block.remoteLines.length} lines
                </Button>
              </div>
            );
          }
        } else if (block.type === 'removed') {
          // Show placeholder for lines that exist only in local (deleted in remote)
          const deletedLineCount = block.localLines.length;
          currentLocalLine += deletedLineCount;

          elements.push(
            <div
              key={`${blockIdx}-placeholder`}
              className="px-2 py-0.5 flex items-center justify-between bg-green-500/10 gap-2"
            >
              <span className="text-muted-foreground/70 text-xs italic">
                − {deletedLineCount} line(s) deleted in remote
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => onInsertDeletedMarker(insertPosition, deletedLineCount)}
              >
                <Plus className="size-3" />
                Mark as deleted
              </Button>
            </div>
          );
        }

        // Update local line counter for modified blocks
        if (block.type === 'modified') {
          currentLocalLine += block.localLines.length;
        }

        return elements;
      })}
    </>
  );
}
