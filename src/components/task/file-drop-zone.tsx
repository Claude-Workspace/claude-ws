'use client';

import { useState, useRef, useCallback, type ReactNode, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export function FileDropZone({
  onFilesSelected,
  accept = 'image/*,.pdf,.txt,.md,.ts,.tsx,.js,.jsx,.json,.css,.html',
  maxFiles = 10,
  disabled = false,
  children,
  className,
}: FileDropZoneProps) {
  const t = useTranslations('chat');
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCountRef.current = 0;

      if (disabled) return;

      const files = Array.from(e.dataTransfer?.files || []).slice(0, maxFiles);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [disabled, maxFiles, onFilesSelected]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current++;
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onFilesSelected(files);
      }
      // Reset input for same file re-upload
      e.target.value = '';
    },
    [onFilesSelected]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={cn('relative', className)}
    >
      {children}

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-md pointer-events-none">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Upload className="size-5" />
            <span>{t('dropFilesHere')}</span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled}
      />
    </div>
  );
}

// Export trigger function for external use
export function useFileDropZone() {
  const inputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return { inputRef, openFilePicker };
}
