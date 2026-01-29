'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, AlertCircle, Check, X, FileArchive, File } from 'lucide-react';
import { toast } from 'sonner';

interface FileUploadDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Target directory path for uploads */
  targetPath: string;
  /** Root path of the project */
  rootPath: string;
  /** Display name of target directory */
  targetName: string;
  /** Callback when upload completes successfully */
  onUploadSuccess?: () => void;
}

interface PendingFile {
  file: File;
  name: string;
  size: number;
  isCompressed: boolean;
}

/**
 * FileUploadDialog - Modal for uploading files to a directory
 * Supports multiple files, drag & drop, and optional decompression
 */
export function FileUploadDialog({
  open,
  onOpenChange,
  targetPath,
  rootPath,
  targetName,
  onUploadSuccess,
}: FileUploadDialogProps) {
  const t = useTranslations('sidebar');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [decompress, setDecompress] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File extensions that can be decompressed
  const compressedExtensions = ['.zip', '.tar', '.tar.gz', '.tgz', '.gz'];

  /**
   * Check if a file is a compressed archive
   */
  const isCompressedFile = (filename: string): boolean => {
    const lower = filename.toLowerCase();
    return compressedExtensions.some(ext => lower.endsWith(ext));
  };

  /**
   * Format file size for display
   */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Reset dialog state
   */
  const resetState = () => {
    setPendingFiles([]);
    setDecompress(false);
    setError(null);
    setUploading(false);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle file selection from input or drop
   */
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: PendingFile[] = Array.from(files).map(file => ({
      file,
      name: file.name,
      size: file.size,
      isCompressed: isCompressedFile(file.name),
    }));

    setPendingFiles(prev => [...prev, ...newFiles]);
    setError(null);
  };

  /**
   * Handle file input change
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(e.target.files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Remove a pending file
   */
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Handle drag over
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) {
      setIsDragging(true);
    }
  };

  /**
   * Handle drag leave
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle file drop
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploading) return;
    handleFilesSelected(e.dataTransfer.files);
  };

  /**
   * Handle upload button click
   */
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Upload all pending files
   */
  const handleUpload = async () => {
    if (pendingFiles.length === 0) {
      setError(t('noFilesToUpload'));
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();

      for (const pending of pendingFiles) {
        formData.append('files', pending.file);
      }

      formData.append('targetPath', targetPath);
      formData.append('rootPath', rootPath);
      formData.append('decompress', decompress ? 'true' : 'false');

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('uploadFailed'));
      }

      const data = await res.json();
      const uploadedCount = data.files?.length || pendingFiles.length;
      const decompressedCount = data.files?.filter((f: { decompressed?: boolean }) => f.decompressed).length || 0;

      if (decompressedCount > 0) {
        toast.success(t('uploadSuccessWithDecompress', { count: uploadedCount, decompressed: decompressedCount }));
      } else {
        toast.success(t('uploadSuccess', { count: uploadedCount }));
      }

      onOpenChange(false);
      resetState();
      onUploadSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle dialog close
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  // Check if any pending file is compressed
  const hasCompressedFiles = pendingFiles.some(f => f.isCompressed);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {t('uploadFiles')}
          </DialogTitle>
          <DialogDescription>
            {t('uploadFilesTo', { folder: targetName })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragging ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
            } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={!uploading ? handleUploadClick : undefined}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
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
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('selectMultipleFiles')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Pending files list */}
          {pendingFiles.length > 0 && (
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
                          <span className="ml-2 text-blue-500">
                            ({t('willDecompress')})
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={() => removePendingFile(index)}
                      disabled={uploading}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decompress option */}
          {hasCompressedFiles && (
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="decompress"
                checked={decompress}
                onCheckedChange={(checked) => setDecompress(checked === true)}
                disabled={uploading}
              />
              <Label
                htmlFor="decompress"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {t('decompressUploadedFiles')}
              </Label>
            </div>
          )}

          {/* Info text */}
          {decompress && hasCompressedFiles && (
            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="flex items-start gap-2">
                <FileArchive className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{t('decompressInfo')}</span>
              </p>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={uploading}
          >
            {t('common:cancel')}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || pendingFiles.length === 0}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('uploading')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t('uploadCount', { count: pendingFiles.length })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
