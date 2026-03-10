'use client';

/**
 * Remote content panel for the file diff resolver.
 * Renders the right side of the side-by-side diff view, showing
 * remote (disk) content with interactive insert buttons to merge
 * specific changes into the local working copy.
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiffBlock } from '@/components/editor/diff-algorithm';

export interface DiffPanelRemoteProps {
  diffBlocks: DiffBlock[];
  onInsertLine: (line: string, insertAfterLocalLine: number) => void;
  onInsertBlock: (lines: string[], insertAfterLocalLine: number) => void;
  onInsertDeletedMarker: (insertAfterLocalLine: number, lineCount: number) => void;
}

export function DiffPanelRemote({ diffBlocks, onInsertLine, onInsertBlock, onInsertDeletedMarker }: DiffPanelRemoteProps) {
  const t = useTranslations('editor');
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
                {isSingleLine && !isMarkerLine && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 shrink-0 ml-1 h-5 w-5"
                    onClick={() => onInsertLine(line, insertPosition)}
                    title={t('insertLineIntoLocal')}
                  >
                    <Plus className="size-3" />
                  </Button>
                )}
              </div>
            );
          });

          // "Insert All" button for multi-line blocks
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
                  {t('insertAllLines', { count: block.remoteLines.length })}
                </Button>
              </div>
            );
          }
        } else if (block.type === 'removed') {
          const deletedLineCount = block.localLines.length;
          currentLocalLine += deletedLineCount;

          elements.push(
            <div
              key={`${blockIdx}-placeholder`}
              className="px-2 py-0.5 flex items-center justify-between bg-green-500/10 gap-2"
            >
              <span className="text-muted-foreground/70 text-xs italic">
                − {t('linesDeletedInRemote', { count: deletedLineCount })}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => onInsertDeletedMarker(insertPosition, deletedLineCount)}
              >
                <Plus className="size-3" />
                {t('markAsDeleted')}
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
