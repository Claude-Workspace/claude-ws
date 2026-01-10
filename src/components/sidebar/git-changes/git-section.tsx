'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Minus, Undo2 } from 'lucide-react';
import { GitFileItem } from './git-file-item';
import { cn } from '@/lib/utils';
import type { GitFileStatus } from '@/types';

interface GitSectionProps {
  title: string;
  files: GitFileStatus[];
  defaultExpanded?: boolean;
  selectedFile: string | null;
  onFileClick: (path: string, staged: boolean) => void;
  staged: boolean;
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
  onDiscardFile?: (path: string) => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onDiscardAll?: () => void;
}

export function GitSection({
  title,
  files,
  defaultExpanded = true,
  selectedFile,
  onFileClick,
  staged,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onStageAll,
  onUnstageAll,
  onDiscardAll,
}: GitSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (files.length === 0) return null;

  return (
    <div className="mb-1">
      {/* Section header */}
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
          'hover:bg-accent/30 transition-colors rounded-sm cursor-pointer'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        <span className="flex-1">{title}</span>

        {/* Section action buttons (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {staged ? (
            // Unstage all for staged section
            <button
              className="p-0.5 hover:bg-accent rounded"
              onClick={(e) => {
                e.stopPropagation();
                onUnstageAll?.();
              }}
              title="Unstage All Changes"
            >
              <Minus className="size-3.5" />
            </button>
          ) : (
            <>
              {/* Discard all */}
              <button
                className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscardAll?.();
                }}
                title="Discard All Changes"
              >
                <Undo2 className="size-3.5" />
              </button>
              {/* Stage all */}
              <button
                className="p-0.5 hover:bg-accent rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onStageAll?.();
                }}
                title="Stage All Changes"
              >
                <Plus className="size-3.5" />
              </button>
            </>
          )}
        </div>

        {/* File count badge */}
        <span className="px-1.5 py-0.5 bg-muted/80 rounded text-[10px] font-semibold ml-1">
          {files.length}
        </span>
      </div>

      {/* File list */}
      {isExpanded && (
        <div className="mt-0.5">
          {files.map((file) => (
            <GitFileItem
              key={file.path}
              file={file}
              isSelected={selectedFile === file.path}
              staged={staged}
              onClick={() => onFileClick(file.path, staged)}
              onStage={onStageFile ? () => onStageFile(file.path) : undefined}
              onUnstage={onUnstageFile ? () => onUnstageFile(file.path) : undefined}
              onDiscard={onDiscardFile ? () => onDiscardFile(file.path) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
