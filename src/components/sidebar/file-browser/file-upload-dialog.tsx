'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, AlertCircle, Check, FileArchive } from 'lucide-react';
import { toast } from 'sonner';
import { FileUploadDropZone } from './file-upload-drop-zone';
import { FileUploadPendingFilesList, type PendingFile } from './file-upload-pending-files-list';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPath: string;
  rootPath: string;
  targetName: string;
  onUploadSuccess?: () => void;
}

const COMPRESSED_EXTENSIONS = ['.zip', '.tar', '.tar.gz', '.tgz', '.gz'];
const isCompressedFile = (name: string) => COMPRESSED_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));

/**
 * FileUploadDialog - Modal for uploading files to a project directory.
 * Supports multiple files, drag & drop, and optional archive decompression.
 * Drop zone extracted into file-upload-drop-zone.tsx.
 * File list extracted into file-upload-pending-files-list.tsx.
 */
export function FileUploadDialog({ open, onOpenChange, targetPath, rootPath, targetName, onUploadSuccess }: FileUploadDialogProps) {
  const t = useTranslations('sidebar');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [decompress, setDecompress] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => { setPendingFiles([]); setDecompress(false); setError(null); setUploading(false); setIsDragging(false); };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPendingFiles(prev => [...prev, ...Array.from(files).map(f => ({
      file: f, name: f.name, size: f.size, isCompressed: isCompressedFile(f.name),
    }))]);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!uploading) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (!uploading) handleFilesSelected(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) { setError(t('noFilesToUpload')); return; }
    setUploading(true); setError(null);
    try {
      const formData = new FormData();
      pendingFiles.forEach(p => formData.append('files', p.file));
      formData.append('targetPath', targetPath);
      formData.append('rootPath', rootPath);
      formData.append('decompress', decompress ? 'true' : 'false');

      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || t('uploadFailed')); }

      const data = await res.json();
      const uploadedCount = data.files?.length || pendingFiles.length;
      const decompressedCount = data.files?.filter((f: { decompressed?: boolean }) => f.decompressed).length || 0;
      toast.success(decompressedCount > 0
        ? t('uploadSuccessWithDecompress', { count: uploadedCount, decompressed: decompressedCount })
        : t('uploadSuccess', { count: uploadedCount }));
      onOpenChange(false); resetState(); onUploadSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('uploadFailed'));
    } finally { setUploading(false); }
  };

  const handleOpenChange = (newOpen: boolean) => { if (!newOpen) resetState(); onOpenChange(newOpen); };
  const hasCompressedFiles = pendingFiles.some(f => f.isCompressed);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />{t('uploadFiles')}
          </DialogTitle>
          <DialogDescription>{t('uploadFilesTo', { folder: targetName })}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <FileUploadDropZone isDragging={isDragging} uploading={uploading}
            onFilesSelected={handleFilesSelected} onDragOver={handleDragOver}
            onDragLeave={handleDragLeave} onDrop={handleDrop} />

          <FileUploadPendingFilesList pendingFiles={pendingFiles} decompress={decompress}
            uploading={uploading} onRemove={(i) => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} />

          {hasCompressedFiles && (
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox id="decompress" checked={decompress}
                onCheckedChange={(c) => setDecompress(c === true)} disabled={uploading} />
              <Label htmlFor="decompress" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                {t('decompressUploadedFiles')}
              </Label>
            </div>
          )}

          {decompress && hasCompressedFiles && (
            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="flex items-start gap-2">
                <FileArchive className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{t('decompressInfo')}</span>
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={uploading}>{t('cancel')}</Button>
          <Button onClick={handleUpload} disabled={uploading || pendingFiles.length === 0}>
            {uploading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('uploading')}</>
              : <><Check className="w-4 h-4 mr-2" />{t('uploadCount', { count: pendingFiles.length })}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
