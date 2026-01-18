'use client';

import { ChevronRight, ChevronDown } from 'lucide-react';
import { FileIcon } from './file-icon';
import { cn } from '@/lib/utils';
import type { FileEntry } from '@/types';

interface FileTreeItemProps {
  entry: FileEntry;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onClick: () => void;
}

export function FileTreeItem({
  entry,
  level,
  isExpanded,
  isSelected,
  onToggle,
  onClick,
}: FileTreeItemProps) {
  const isDirectory = entry.type === 'directory';
  const hasChildren = isDirectory && entry.children && entry.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      onToggle();
    } else {
      onClick();
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 py-1 px-2 cursor-pointer rounded-sm text-sm relative',
        'hover:bg-accent/50 transition-colors',
        isSelected && 'bg-primary/20 text-primary-foreground dark:bg-primary/30'
      )}
      style={{ paddingLeft: `${level * 16 + 8}px` }}
      onClick={handleClick}
    >
      {/* Indent guide lines */}
      {level > 0 && Array.from({ length: level }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 w-px bg-border/50"
          style={{ left: `${i * 16 + 16}px` }}
        />
      ))}

      {/* Chevron for directories / spacer for files */}
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        {isDirectory ? (
          hasChildren ? (
            <button
              onClick={handleChevronClick}
              className="hover:bg-accent rounded-sm"
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          ) : null
        ) : null}
      </div>

      {/* File/folder icon */}
      <FileIcon
        name={entry.name}
        type={entry.type}
        isExpanded={isExpanded}
        className="shrink-0"
      />

      {/* File/folder name */}
      <span className="truncate flex-1">{entry.name}</span>

      {/* Git status indicator */}
      {!isDirectory && entry.gitStatus && (
        <span className={cn(
          'text-xs font-medium shrink-0',
          entry.gitStatus === 'M' && 'text-yellow-500',
          entry.gitStatus === 'A' && 'text-green-500',
          entry.gitStatus === 'D' && 'text-red-500',
          entry.gitStatus === 'U' && 'text-green-500',
          entry.gitStatus === 'R' && 'text-blue-500'
        )}>
          {entry.gitStatus}
        </span>
      )}
    </div>
  );
}
