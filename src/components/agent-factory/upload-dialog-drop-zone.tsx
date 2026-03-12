'use client';

/**
 * Reusable drag-and-drop file upload zone for archive files (.zip, .tar, .gz, etc.)
 * Used by both the agent-factory upload dialog and project-settings plugin upload dialog.
 */

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Loader2 } from 'lucide-react';

export const ACCEPTED_ARCHIVE_TYPES = [
  '.zip',
  '.tar',
  '.gz',
  '.gzip',
  '.tgz',
  'application/zip',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-gtar',
];

export const VALID_ARCHIVE_EXTENSIONS = ['.zip', '.tar', '.gz', '.gzip', '.tgz'];

/** Returns true if the file name has a valid archive extension */
export function isValidArchiveFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return VALID_ARCHIVE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

interface UploadDialogDropZoneProps {
  uploading: boolean;
  isDragging: boolean;
  onFileSelect: (file: File) => void;
  onDragStateChange: (dragging: boolean) => void;
  onInvalidFile: () => void;
}

/**
 * Drop zone with file input, drag-over highlighting, and uploading spinner.
 * Calls onFileSelect with the validated File, or onInvalidFile if extension is wrong.
 */
export function UploadDialogDropZone({
  uploading,
  isDragging,
  onFileSelect,
  onDragStateChange,
  onInvalidFile,
}: UploadDialogDropZoneProps) {
  const t = useTranslations('agentFactory');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidArchiveFile(file.name)) {
      onInvalidFile();
      return;
    }
    onFileSelect(file);
    // Clear so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) onDragStateChange(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragStateChange(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragStateChange(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!isValidArchiveFile(file.name)) {
      onInvalidFile();
      return;
    }
    onFileSelect(file);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        isDragging ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
      }`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_ARCHIVE_TYPES.join(',')}
        onChange={handleChange}
        className="hidden"
        disabled={uploading}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{t('analyzingArchive')}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Upload className="w-12 h-12 text-muted-foreground" />
          <div>
            <p className="font-medium">{t('clickToUploadOrDrag')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('supportedFormats')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
