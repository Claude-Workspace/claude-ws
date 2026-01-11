'use client';

import { Plus } from 'lucide-react';
import { FilePreview } from './file-preview';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { PendingFile } from '@/types';

interface AttachmentBarProps {
  files: PendingFile[];
  onRemove: (tempId: string) => void;
  onRetry?: (tempId: string) => void;
  onAddFiles: () => void;
}

export function AttachmentBar({
  files,
  onRemove,
  onRetry,
  onAddFiles,
}: AttachmentBarProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
      <ScrollArea className="flex-1" type="scroll">
        <div className="flex gap-3 py-1">
          {files.map((file) => (
            <FilePreview
              key={file.tempId || file.originalName}
              file={file}
              onRemove={() => onRemove(file.tempId)}
              onRetry={onRetry ? () => onRetry(file.tempId) : undefined}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Add more files button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onAddFiles}
        title="Add more files"
        type="button"
        className="shrink-0"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
