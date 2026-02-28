'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileArchive, Loader2, AlertCircle, Package, FileText, Folder, Check, X, Globe } from 'lucide-react';

interface PreviewItem {
  type: 'skill' | 'command' | 'agent' | 'agent_set' | 'unknown';
  name: string;
  targetPath: string;
  pluginCount?: number;
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: () => void;
}

export function UploadDialog({ open, onOpenChange, onUploadSuccess }: UploadDialogProps) {
  const t = useTranslations('agentFactory');
  const tCommon = useTranslations('common');
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [
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

  const resetState = () => {
    setStep('upload');
    setUploading(false);
    setError(null);
    setPreviewItems([]);
    setUploadedFileName('');
    setSessionId(null);
    setIsDragging(false);
    // Clear file input when dialog closes
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    const validExtensions = ['.zip', '.tar', '.gz', '.gzip', '.tgz'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExtension) {
      setError(t('invalidFileType'));
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', 'true');

      const res = await fetch('/api/agent-factory/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to analyze file');
      }

      const data = await res.json();

      // Store sessionId for confirmation
      setSessionId(data.sessionId);
      setPreviewItems(data.items || []);
      setUploadedFileName(file.name);
      setStep('preview');

      // Clear file input since we now have the session
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async (globalImport: boolean = false) => {
    if (!sessionId) {
      setError('Session expired. Please upload the file again.');
      return;
    }

    setStep('importing');
    setError(null);

    try {
      // Confirm with sessionId - no file re-upload needed
      const res = await fetch('/api/agent-factory/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          confirm: true,
          globalImport,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to import file');
      }

      // Close dialog and trigger refresh
      onOpenChange(false);
      resetState();

      // Trigger success callback to refresh components
      onUploadSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
      setStep('preview');
    }
  };

  const handleCancel = async () => {
    if (sessionId) {
      // Clean up the session on cancel
      try {
        await fetch('/api/agent-factory/upload/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });
      } catch {
        // Ignore cleanup errors
      }
    }
    setStep('upload');
    setError(null);
    setPreviewItems([]);
    setUploadedFileName('');
    setSessionId(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Validate file extension
    const validExtensions = ['.zip', '.tar', '.gz', '.gzip', '.tgz'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExtension) {
      setError(t('invalidFileType'));
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', 'true');

      const res = await fetch('/api/agent-factory/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to analyze file');
      }

      const data = await res.json();

      // Store sessionId for confirmation
      setSessionId(data.sessionId);
      setPreviewItems(data.items || []);
      setUploadedFileName(file.name);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      setUploading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'skill':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'command':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'agent':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'agent_set':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'skill':
        return <Folder className="w-4 h-4" />;
      case 'command':
      case 'agent':
        return <FileText className="w-4 h-4" />;
      case 'agent_set':
        return <Package className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'agent_set':
        return 'Agent Set';
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        // Clean up session when dialog is closed
        handleCancel();
        resetState();
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="w-5 h-5" />
            {step === 'preview' ? t('confirmImport') : t('importFromArchive')}
          </DialogTitle>
          <DialogDescription>
            {step === 'preview'
              ? `Review ${previewItems.length} plugin(s) found in ${uploadedFileName}`
              : t('supportedFormats')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {step === 'upload' && (
            <>
              {/* Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                }`}
                onClick={!uploading ? handleUploadClick : undefined}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedTypes.join(',')}
                  onChange={handleFileSelect}
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
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('supportedFormats')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Info */}
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <p className="font-medium mb-2">{t('automaticOrganization')}</p>
                <p className="text-xs mb-2">
                  Files will be automatically organized into the correct folders:
                </p>
                <ul className="text-xs space-y-1 ml-4">
                  <li>• <strong>Skills:</strong> Folders with <code>SKILL.md</code> → <code>skills/</code></li>
                  <li>• <strong>Commands:</strong> <code>@command</code> or command-type files → <code>commands/</code></li>
                  <li>• <strong>Agents:</strong> <code>@agent</code> or agent-type files → <code>agents/</code></li>
                </ul>
                <p className="text-xs mt-2">
                  Pre-organized archives with <code>skills/</code>, <code>commands/</code>, <code>agents/</code> folders are also supported.
                </p>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              {/* Preview List */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-sm font-medium border-b">
                  {t('itemsToImport')} ({previewItems.length})
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {previewItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30"
                    >
                      {getTypeIcon(item.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {item.type === 'agent_set' && item.pluginCount !== undefined && (
                            <span className="text-xs text-muted-foreground">({item.pluginCount} plugins)</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.targetPath}</p>
                      </div>
                      <Badge className={getTypeColor(item.type)}>
                        {getTypeLabel(item.type)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Success info */}
              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg text-sm">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  {t('archiveAnalyzed')}
                </span>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">{t('importingPlugins')}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === 'preview' ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={uploading}>
                <X className="w-4 h-4 mr-1" />
                {tCommon('cancel')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfirmImport(true)}
                disabled={uploading}
                title="Import to ~/.claude (globally available)"
              >
                <Globe className="w-4 h-4 mr-1" />
                {t('importGlobally')}
              </Button>
              <Button onClick={() => handleConfirmImport(false)} disabled={uploading}>
                <Check className="w-4 h-4 mr-1" />
                Import {previewItems.length} Plugin(s)
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              {tCommon('cancel')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
