'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
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
}

export function GitSection({
  title,
  files,
  defaultExpanded = true,
  selectedFile,
  onFileClick,
  staged,
}: GitSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (files.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        className={cn(
          'w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium',
          'hover:bg-accent/30 transition-colors rounded-sm'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        <span className="flex-1 text-left">{title}</span>
        <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-semibold">
          {files.length}
        </span>
      </button>

      {isExpanded && (
        <div className="ml-2 mt-0.5">
          {files.map((file) => (
            <GitFileItem
              key={file.path}
              file={file}
              isSelected={selectedFile === file.path}
              onClick={() => onFileClick(file.path, staged)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
