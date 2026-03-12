'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileArchive, AlertCircle, Check, X, Globe, Loader2 } from 'lucide-react';
import { UploadDialogDropZone } from '@/components/agent-factory/upload-dialog-drop-zone';
import { UploadDialogPreviewItemsList } from '@/components/agent-factory/upload-dialog-preview-items-list';
import { UploadDialogArchiveInfoPanel } from '@/components/agent-factory/upload-dialog-archive-info-panel';

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
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => {
    setStep('upload'); setUploading(false); setError(null);
    setPreviewItems([]); setUploadedFileName(''); setSessionId(null); setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setUploading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', 'true');
      const res = await fetch('/api/agent-factory/upload', { method: 'POST', body: formData });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to analyze file'); }
      const data = await res.json();
      setSessionId(data.sessionId); setPreviewItems(data.items || []); setUploadedFileName(file.name); setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally { setUploading(false); }
  };

  const handleConfirmImport = async (globalImport = false) => {
    if (!sessionId) { setError('Session expired. Please upload the file again.'); return; }
    setStep('importing'); setError(null);
    try {
      const res = await fetch('/api/agent-factory/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, confirm: true, globalImport }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to import file'); }
      onOpenChange(false); resetState(); onUploadSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file'); setStep('preview');
    }
  };

  const handleCancel = async () => {
    if (sessionId) {
      try {
        await fetch('/api/agent-factory/upload/cancel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }),
        });
      } catch { /* ignore */ }
    }
    setStep('upload'); setError(null); setPreviewItems([]); setUploadedFileName(''); setSessionId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { handleCancel(); resetState(); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="w-5 h-5" />
            {step === 'preview' ? t('confirmImport') : t('importFromArchive')}
          </DialogTitle>
          <DialogDescription>
            {step === 'preview' ? `Review ${previewItems.length} plugin(s) found in ${uploadedFileName}` : t('supportedFormats')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {step === 'upload' && (
            <>
              <UploadDialogDropZone
                uploading={uploading} isDragging={isDragging}
                onFileSelect={processFile} onDragStateChange={setIsDragging}
                onInvalidFile={() => setError(t('invalidFileType'))}
              />
              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              <UploadDialogArchiveInfoPanel automaticOrganizationLabel={t('automaticOrganization')} />
            </>
          )}

          {step === 'preview' && (
            <>
              <UploadDialogPreviewItemsList items={previewItems} headerLabel={t('itemsToImport')} />
              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg text-sm">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{t('archiveAnalyzed')}</span>
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
                <X className="w-4 h-4 mr-1" />{tCommon('cancel')}
              </Button>
              <Button variant="outline" onClick={() => handleConfirmImport(true)} disabled={uploading} title="Import to ~/.claude (globally available)">
                <Globe className="w-4 h-4 mr-1" />{t('importGlobally')}
              </Button>
              <Button onClick={() => handleConfirmImport(false)} disabled={uploading}>
                <Check className="w-4 h-4 mr-1" />Import {previewItems.length} Plugin(s)
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>{tCommon('cancel')}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
