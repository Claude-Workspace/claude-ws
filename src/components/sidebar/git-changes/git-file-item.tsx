'use client';

import { File } from 'lucide-react';
import { GitStatusBadge } from './git-status-badge';
import { cn } from '@/lib/utils';
import type { GitFileStatus } from '@/types';

interface GitFileItemProps {
  file: GitFileStatus;
  isSelected: boolean;
  onClick: () => void;
}

export function GitFileItem({ file, isSelected, onClick }: GitFileItemProps) {
  // Get just the filename from the path
  const fileName = file.path.split('/').pop() || file.path;
  // Get parent directory for context
  const parentDir = file.path.includes('/')
    ? file.path.split('/').slice(0, -1).join('/')
    : '';

  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1 text-sm text-left rounded-sm',
        'hover:bg-accent/50 transition-colors',
        isSelected && 'bg-accent text-accent-foreground'
      )}
      onClick={onClick}
      title={file.path}
    >
      <GitStatusBadge status={file.status} />
      <File className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate flex-1">
        {fileName}
        {parentDir && (
          <span className="text-muted-foreground ml-1 text-xs">
            {parentDir}
          </span>
        )}
      </span>
    </button>
  );
}
