'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, MoreVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FileIcon } from './file-icon';
import { FileTreeContextMenuContent } from './file-tree-context-menu';
import { FileTreeItemInlineRename } from './file-tree-item-inline-rename';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
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

  const isDirectory = entry.type === 'directory';
  const hasChildren = isDirectory && entry.children && entry.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    if (isRenaming) { e.stopPropagation(); return; }
    e.stopPropagation();
    console.log('[FileTreeItem] handleClick called', { path: entry.path, detail: e.detail });
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    if (e.button === 2) { if (onSelect) onSelect(); else onClick(); return; }
    if (isDirectory) onToggle(); else onClick();
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    if (isRenaming) { e.stopPropagation(); return; }
    e.stopPropagation(); onToggle();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isRenaming) { e.stopPropagation(); e.preventDefault(); return; }
    e.preventDefault();
    if (onSelect) onSelect(); else onClick();
    setContextMenuOpen(true);
  };

  const startRename = () => { setRenameValue(entry.name); setIsRenaming(true); onRenameStart?.(); };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue(entry.name);
    onRenameEnd?.();
  };

  const handleRenameSuccess = () => {
    setIsRenaming(false);
    onRefresh?.();
    onRenameEnd?.();
  };

  return (
    <DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
      <div
        data-path={entry.path}
        className={cn(
          'flex items-center gap-1 py-1 px-2 cursor-pointer rounded-sm text-sm relative group',
          !isSelected && 'hover:bg-accent/50 transition-colors',
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
          {isDirectory && hasChildren ? (
            <button onClick={handleChevronClick} className="hover:bg-accent rounded-sm">
              {isExpanded
                ? <ChevronDown className="size-4" />
                : <ChevronRight className="size-4" />}
            </button>
          ) : null}
        </div>

        {/* File/folder icon */}
        <FileIcon name={entry.name} type={entry.type} isExpanded={isExpanded} className="shrink-0" />

        {/* Name or inline rename input — extracted into file-tree-item-inline-rename.tsx */}
        {isRenaming ? (
          <FileTreeItemInlineRename
            entry={entry}
            rootPath={rootPath}
            renameValue={renameValue}
            isSaving={isSaving}
            onRenameValueChange={setRenameValue}
            onCancel={cancelRename}
            onSuccess={handleRenameSuccess}
            onSavingChange={setIsSaving}
          />
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

        {/* Context menu trigger button */}
        {!isRenaming && isSelected && (
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-5 w-5 p-0 shrink-0', 'hover:bg-accent data-[state=open]:bg-accent')}
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
