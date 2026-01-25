'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { FileIcon } from './file-icon';
import { FileTreeContextMenu } from './file-tree-context-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { FileEntry } from '@/types';

interface FileTreeItemProps {
  entry: FileEntry;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onClick: () => void;
  rootPath: string;
  onRefresh?: () => void;
  onRenameStart?: () => void;
  onRenameEnd?: () => void;
}

export function FileTreeItem({
  entry,
  level,
  isExpanded,
  isSelected,
  onToggle,
  onClick,
  rootPath,
  onRefresh,
  onRenameStart,
  onRenameEnd,
}: FileTreeItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDirectory = entry.type === 'directory';
  const hasChildren = isDirectory && entry.children && entry.children.length > 0;

  // Focus and select text when rename starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = (e: React.MouseEvent) => {
    if (isRenaming) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    if (isDirectory) {
      onToggle();
    } else {
      onClick();
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    if (isRenaming) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    onToggle();
  };

  const startRename = () => {
    setRenameValue(entry.name);
    setIsRenaming(true);
    onRenameStart?.();
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue(entry.name);
    onRenameEnd?.();
  };

  const submitRename = async () => {
    const trimmedName = renameValue.trim();
    if (!trimmedName) {
      toast.error('Name cannot be empty');
      return;
    }
    if (trimmedName === entry.name) {
      cancelRename();
      return;
    }

    setIsSaving(true);
    try {
      const fullPath = `${rootPath}/${entry.path}`;
      const res = await fetch('/api/files/operations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath, rootPath, newName: trimmedName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Rename failed');
      }

      toast.success('Rename successful');
      setIsRenaming(false);
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
      setRenameValue(entry.name);
    } finally {
      setIsSaving(false);
      onRenameEnd?.();
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSaving) {
      e.preventDefault();
      submitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  };

  const handleRenameBlur = () => {
    if (!isSaving) {
      submitRename();
    }
  };

  return (
    <FileTreeContextMenu
      entry={entry}
      rootPath={rootPath}
      onDelete={onRefresh}
      onRename={startRename}
      onRefresh={onRefresh}
    >
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 cursor-pointer rounded-sm text-sm relative',
          'hover:bg-accent/50 transition-colors',
          isSelected && 'bg-primary/20 text-primary-foreground dark:bg-primary/30',
          isRenaming && 'bg-accent cursor-default'
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

        {/* File/folder name or input */}
        {isRenaming ? (
          <div className="flex-1 flex items-center gap-1">
            <Input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleRenameBlur}
              disabled={isSaving}
              className="h-6 px-1 py-0 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
            {isSaving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <span className="truncate flex-1">{entry.name}</span>
        )}

        {/* Git status indicator */}
        {!isRenaming && !isDirectory && entry.gitStatus && (
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
    </FileTreeContextMenu>
  );
}
