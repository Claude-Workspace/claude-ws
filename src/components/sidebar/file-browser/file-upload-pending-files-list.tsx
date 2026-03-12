'use client';

import { FileArchive, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface PendingFile {
  file: File;
  name: string;
  size: number;
  isCompressed: boolean;
}

interface FileUploadPendingFilesListProps {
  pendingFiles: PendingFile[];
  decompress: boolean;
  uploading: boolean;
  onRemove: (index: number) => void;
}

/** Format raw byte count into a human-readable size string */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * FileUploadPendingFilesList - Scrollable list of files queued for upload.
 * Shows name, size, compressed indicator, and a remove button per entry.
 */
export function FileUploadPendingFilesList({
  pendingFiles,
  decompress,
  uploading,
  onRemove,
}: FileUploadPendingFilesListProps) {
  const t = useTranslations('sidebar');

  if (pendingFiles.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-3 py-2 text-sm font-medium border-b">
        {t('selectedFiles', { count: pendingFiles.length })}
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {pendingFiles.map((pending, index) => (
          <div
            key={`${pending.name}-${index}`}
            className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30"
          >
            {pending.isCompressed ? (
              <FileArchive className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{pending.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatSize(pending.size)}
                {pending.isCompressed && decompress && (
                  <span className="ml-2 text-blue-500">({t('willDecompress')})</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 flex-shrink-0"
              onClick={() => onRemove(index)}
              disabled={uploading}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { PendingFile };
