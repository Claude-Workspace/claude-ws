'use client';

import { useState, useEffect } from 'react';
import { Loader2, X, FileCode, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';
import type { GitDiff } from '@/types';

interface DiffViewerProps {
  filePath: string;
  staged: boolean;
  onClose: () => void;
}

interface DiffLine {
  type: 'addition' | 'deletion' | 'context' | 'header' | 'hunk';
  content: string;
  lineNumber?: { old?: number; new?: number };
}

export function DiffViewer({ filePath, staged, onClose }: DiffViewerProps) {
  const { currentProject } = useProjectStore();
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProject?.path) return;

    const fetchDiff = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          path: currentProject.path,
          file: filePath,
          staged: staged.toString(),
        });
        const res = await fetch(`/api/git/diff?${params}`);
        if (!res.ok) throw new Error('Failed to fetch diff');
        const data = await res.json();
        setDiff(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDiff();
  }, [currentProject?.path, filePath, staged]);

  const parseDiff = (rawDiff: string): DiffLine[] => {
    const lines: DiffLine[] = [];
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of rawDiff.split('\n')) {
      if (line.startsWith('diff ') || line.startsWith('index ')) {
        lines.push({ type: 'header', content: line });
      } else if (line.startsWith('---') || line.startsWith('+++')) {
        lines.push({ type: 'header', content: line });
      } else if (line.startsWith('@@')) {
        // Parse hunk header: @@ -start,count +start,count @@
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          oldLineNum = parseInt(match[1], 10);
          newLineNum = parseInt(match[2], 10);
        }
        lines.push({ type: 'hunk', content: line });
      } else if (line.startsWith('+')) {
        lines.push({
          type: 'addition',
          content: line.slice(1),
          lineNumber: { new: newLineNum++ },
        });
      } else if (line.startsWith('-')) {
        lines.push({
          type: 'deletion',
          content: line.slice(1),
          lineNumber: { old: oldLineNum++ },
        });
      } else {
        lines.push({
          type: 'context',
          content: line.startsWith(' ') ? line.slice(1) : line,
          lineNumber: { old: oldLineNum++, new: newLineNum++ },
        });
      }
    }

    return lines;
  };

  const fileName = filePath.split('/').pop() || filePath;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate" title={filePath}>
            {fileName}
          </span>
          <span className="text-xs text-muted-foreground">
            ({staged ? 'staged' : 'unstaged'})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {diff && (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-0.5 text-green-600">
                <Plus className="size-3" />
                {diff.additions}
              </span>
              <span className="flex items-center gap-0.5 text-red-600">
                <Minus className="size-3" />
                {diff.deletions}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full text-destructive text-sm">
          {error}
        </div>
      ) : diff && diff.diff ? (
        <ScrollArea className="flex-1">
          <div className="font-mono text-xs">
            {parseDiff(diff.diff).map((line, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  line.type === 'addition' && 'bg-green-500/15',
                  line.type === 'deletion' && 'bg-red-500/15',
                  line.type === 'header' && 'bg-muted/50 text-muted-foreground',
                  line.type === 'hunk' && 'bg-blue-500/10 text-blue-600'
                )}
              >
                {/* Line numbers */}
                <div className="flex shrink-0 text-muted-foreground/60 select-none">
                  <span className="w-10 text-right pr-1 border-r border-border/50">
                    {line.lineNumber?.old ?? ''}
                  </span>
                  <span className="w-10 text-right pr-1 border-r border-border/50">
                    {line.lineNumber?.new ?? ''}
                  </span>
                </div>
                {/* Line content */}
                <pre className="flex-1 px-2 whitespace-pre-wrap break-all">
                  {line.type === 'addition' && (
                    <span className="text-green-700 dark:text-green-400">+ </span>
                  )}
                  {line.type === 'deletion' && (
                    <span className="text-red-700 dark:text-red-400">- </span>
                  )}
                  {line.content}
                </pre>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          No changes to display
        </div>
      )}
    </div>
  );
}
