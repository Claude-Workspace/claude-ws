'use client';

import { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FileUploadDropZoneProps {
  isDragging: boolean;
  uploading: boolean;
  onFilesSelected: (files: FileList | null) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

/**
 * FileUploadDropZone - Drag-and-drop area with hidden file input for the upload dialog.
 * Handles drag visual state and file input click forwarding.
 */
export function FileUploadDropZone({
  isDragging,
  uploading,
  onFilesSelected,
  onDragOver,
  onDragLeave,
  onDrop,
}: FileUploadDropZoneProps) {
  const t = useTranslations('sidebar');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files);
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
        isDragging ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
      } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={handleClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{t('uploading')}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-10 h-10 text-muted-foreground" />
          <div>
            <p className="font-medium">{t('clickToUploadOrDrop')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('selectMultipleFiles')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
