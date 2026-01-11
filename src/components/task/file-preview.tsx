'use client';

import { X, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { FileIcon } from './file-icon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PendingFile } from '@/types';

interface FilePreviewProps {
  file: PendingFile;
  onRemove: () => void;
  onRetry?: () => void;
}

export function FilePreview({ file, onRemove, onRetry }: FilePreviewProps) {
  const isImage = file.mimeType.startsWith('image/');
  const isUploading = file.status === 'uploading';
  const isError = file.status === 'error';
  const isPending = file.status === 'pending';

  return (
    <div className="relative group flex-shrink-0">
      {/* Preview container */}
      <div
        className={cn(
          'size-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden transition-colors',
          isError && 'border-destructive/50 bg-destructive/5'
        )}
      >
        {/* Image preview or file icon */}
        {isImage && file.previewUrl ? (
          <img
            src={file.previewUrl}
            alt={file.originalName}
            className="size-full object-cover"
          />
        ) : (
          <FileIcon
            mimeType={file.mimeType}
            className="size-8 text-muted-foreground"
          />
        )}

        {/* Upload progress overlay */}
        {(isUploading || isPending) && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}

        {/* Error indicator */}
        {isError && (
          <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
            <AlertCircle className="size-5 text-destructive" />
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className={cn(
          'absolute -top-1.5 -right-1.5 size-5 rounded-full bg-background border shadow-sm',
          'flex items-center justify-center',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-muted'
        )}
        type="button"
        aria-label={`Remove ${file.originalName}`}
      >
        <X className="size-3" />
      </button>

      {/* Retry button for errors */}
      {isError && onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'absolute -bottom-1.5 -right-1.5 size-5 rounded-full bg-background border shadow-sm',
            'flex items-center justify-center',
            'hover:bg-muted'
          )}
          type="button"
          aria-label={`Retry uploading ${file.originalName}`}
        >
          <RotateCcw className="size-3" />
        </button>
      )}

      {/* Filename tooltip */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs truncate max-w-16 mt-1 text-muted-foreground text-center">
              {file.originalName}
            </p>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{file.originalName}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
              {file.error && ` • ${file.error}`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
