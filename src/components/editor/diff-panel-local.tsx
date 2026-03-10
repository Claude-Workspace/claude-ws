'use client';

/**
 * Local/working content panel for the file diff resolver.
 * Renders the left side of the side-by-side diff view, showing
 * the user's local content with diff highlighting.
 */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { DiffBlock } from '@/components/editor/diff-algorithm';

interface DiffPanelLocalProps {
  diffBlocks: DiffBlock[];
}

export function DiffPanelLocal({ diffBlocks }: DiffPanelLocalProps) {
  const t = useTranslations('editor');
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
          elements.push(
            <div
              key={`${blockIdx}-placeholder`}
              className="px-2 py-0.5 flex bg-blue-500/10 text-muted-foreground/50 italic"
            >
              <span className="w-8 text-right mr-2 shrink-0">+</span>
              <span className="flex-1">{t('linesInRemote', { count: block.remoteLines.length })}</span>
            </div>
          );
        }

        return elements;
      })}
    </>
  );
}
