'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Loader2, MoreVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FileIcon } from './file-icon';
import { FileTreeContextMenuContent } from './file-tree-context-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  /** Callback to select the file without opening it (used for right-click) */
  onSelect?: () => void;
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
  onSelect,
  rootPath,
  onRefresh,
  onRenameStart,
  onRenameEnd,
}: FileTreeItemProps) {
  const t = useTranslations('sidebar');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);
  const [isSaving, setIsSaving] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
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

    // DEBUG: Log click events
    console.log('[FileTreeItem] handleClick called', { path: entry.path, detail: e.detail });

    // Immediate visual feedback
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);

    if (e.button === 2) {
      // Right-click - just select, don't toggle or open file in viewer
      // Use onSelect if provided (selection only), otherwise fall back to onClick
      if (onSelect) {
        onSelect();
      } else {
        onClick();
      }
      return;
    }

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

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isRenaming) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    e.preventDefault();
    // Select the item when right-clicking (without opening in file viewer) and open context menu
    if (onSelect) {
      onSelect();
    } else {
      onClick();
    }
    setContextMenuOpen(true);
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
      toast.error(t('nameCannotBeEmpty'));
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
        throw new Error(data.error || t('renameFailed'));
      }

      toast.success(t('renameSuccessful'));
      setIsRenaming(false);
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('renameFailed'));
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
      cancelRename();
    }
  };

  return (
    <DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
      <div
        data-path={entry.path}
        className={cn(
          'flex items-center gap-1 py-1 px-2 cursor-pointer rounded-sm text-sm relative group',
          // Hover: only apply when not selected
          !isSelected && 'hover:bg-accent/50 transition-colors',
          // Selected state
          isSelected && 'bg-primary/20 dark:bg-primary/30',
          isSelected && 'hover:bg-primary/30 dark:hover:bg-primary/40',
          isPressed && 'bg-primary/10',
          isRenaming && 'bg-accent cursor-default'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Indent guide lines */}
        {level > 0 && Array.from({ length: level }).map((_, i) => (
          <div
            key={`indent-${i}`}
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
              className="h-6 px-2 py-0 text-sm bg-white dark:bg-slate-900 border-2 border-primary text-foreground dark:text-foreground"
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

        {/* Context menu button */}
        {!isRenaming && isSelected && (
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-5 w-5 p-0 shrink-0',
                'hover:bg-accent data-[state=open]:bg-accent'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-3" />
            </Button>
          </DropdownMenuTrigger>
        )}
      </div>

      <DropdownMenuContent align="end" className="w-48">
        <FileTreeContextMenuContent
          entry={entry}
          rootPath={rootPath}
          onDelete={onRefresh}
          onRename={startRename}
          onRefresh={onRefresh}
          itemType="dropdown"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
