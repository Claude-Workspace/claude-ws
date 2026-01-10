'use client';

import { Plus, Minus, Undo2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GitFileStatus } from '@/types';

interface GitFileItemProps {
  file: GitFileStatus;
  isSelected: boolean;
  staged: boolean;
  onClick: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
}

// VS Code style status colors
const statusColors: Record<string, string> = {
  M: 'text-yellow-500', // Modified
  A: 'text-green-500', // Added
  D: 'text-red-500', // Deleted
  R: 'text-blue-500', // Renamed
  U: 'text-orange-500', // Unmerged
  '?': 'text-green-500', // Untracked (new)
};

const statusLabels: Record<string, string> = {
  M: 'M',
  A: 'A',
  D: 'D',
  R: 'R',
  U: 'U',
  '?': 'U', // Untracked shows as U
};

export function GitFileItem({
  file,
  isSelected,
  staged,
  onClick,
  onStage,
  onUnstage,
  onDiscard,
}: GitFileItemProps) {
  // Get filename and parent directory
  const parts = file.path.split('/');
  const fileName = parts.pop() || file.path;
  const parentDir = parts.length > 0 ? parts.join('/') : '';

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 px-2 py-0.5 text-sm cursor-pointer',
        'hover:bg-accent/50 transition-colors',
        isSelected && 'bg-accent text-accent-foreground'
      )}
      onClick={onClick}
      title={file.path}
    >
      {/* File icon */}
      <FileText className="size-4 shrink-0 text-muted-foreground" />

      {/* File name + parent dir */}
      <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
        <span className="truncate">{fileName}</span>
        {parentDir && (
          <span className="text-xs text-muted-foreground truncate">
            {parentDir}
          </span>
        )}
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {staged ? (
          // Unstage button for staged files
          <button
            className="p-0.5 hover:bg-accent rounded"
            onClick={(e) => {
              e.stopPropagation();
              onUnstage?.();
            }}
            title="Unstage Changes"
          >
            <Minus className="size-3.5" />
          </button>
        ) : (
          <>
            {/* Discard button */}
            <button
              className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onDiscard?.();
              }}
              title="Discard Changes"
            >
              <Undo2 className="size-3.5" />
            </button>
            {/* Stage button */}
            <button
              className="p-0.5 hover:bg-accent rounded"
              onClick={(e) => {
                e.stopPropagation();
                onStage?.();
              }}
              title="Stage Changes"
            >
              <Plus className="size-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Status badge */}
      <span
        className={cn(
          'text-xs font-bold shrink-0 w-4 text-center',
          statusColors[file.status] || 'text-muted-foreground'
        )}
      >
        {statusLabels[file.status] || file.status}
      </span>
    </div>
  );
}
