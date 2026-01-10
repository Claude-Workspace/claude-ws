'use client';

import { CheckCircle2, Circle, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GitFileStatus } from '@/types';

interface GitFileItemProps {
  file: GitFileStatus;
  isSelected: boolean;
  staged: boolean;
  onClick: () => void;
  onStage?: () => void;
  onDiscard?: () => void;
}

export function GitFileItem({
  file,
  isSelected,
  staged,
  onClick,
  onStage,
  onDiscard,
}: GitFileItemProps) {
  const isNew = file.status === 'A' || file.status === '?';
  const hasStats = file.additions !== undefined || file.deletions !== undefined;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer',
        'hover:bg-accent/50 transition-colors',
        isSelected && 'bg-accent text-accent-foreground'
      )}
      onClick={onClick}
      title={file.path}
    >
      {/* Stage/unstage button */}
      <button
        className={cn(
          'shrink-0 transition-colors',
          staged
            ? 'text-green-500 hover:text-green-600'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onStage?.();
        }}
        title={staged ? 'Unstage file' : 'Stage file'}
      >
        {staged ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <Circle className="size-4" />
        )}
      </button>

      {/* File icon */}
      <FileText className="size-4 shrink-0 text-muted-foreground" />

      {/* File path */}
      <span className="truncate flex-1 font-medium">{file.path}</span>

      {/* Stats or New label */}
      {isNew ? (
        <span className="text-xs text-green-500 font-medium shrink-0">New</span>
      ) : hasStats ? (
        <span className="text-xs text-muted-foreground shrink-0">
          <span className="text-green-600">+{file.additions || 0}</span>
          {' '}
          <span className="text-red-500">-{file.deletions || 0}</span>
        </span>
      ) : null}

      {/* Discard button */}
      <button
        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDiscard?.();
        }}
        title="Discard changes"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
