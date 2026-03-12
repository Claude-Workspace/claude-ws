'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileArchive, AlertCircle, Check, X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { UploadDialogDropZone } from '@/components/agent-factory/upload-dialog-drop-zone';
import { UploadDialogPreviewItemsList } from '@/components/agent-factory/upload-dialog-preview-items-list';
import { UploadDialogArchiveInfoPanel } from '@/components/agent-factory/upload-dialog-archive-info-panel';
import { PluginUploadInstallationOptionsPanel } from '@/components/project-settings/plugin-upload-installation-options-panel';
import { usePluginUploadConfirmImport } from '@/components/project-settings/plugin-upload-dialog-use-confirm-import';

interface PreviewItem {
  type: 'skill' | 'command' | 'agent' | 'agent_set' | 'unknown';
  name: string;
  targetPath: string;
  pluginCount?: number;
}

interface PluginUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUploadSuccess?: () => void;
}

/** Plugin upload dialog for project settings — uploads archive, previews, then installs to project + agent factory. */
export function PluginUploadDialog({ open, onOpenChange, projectId, onUploadSuccess }: PluginUploadDialogProps) {
  const t = useTranslations('agentFactory');
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

  const handleCancel = async () => {
    if (sessionId) {
      try {
        await fetch('/api/agent-factory/upload/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch { /* ignore */ }
    }
    setStep('upload'); setError(null); setPreviewItems([]); setUploadedFileName(''); setSessionId(null);
  };

  const { handleConfirmImport } = usePluginUploadConfirmImport({
    sessionId, projectId, previewItems,
    setStep, setError,
    onSuccess: () => onUploadSuccess?.(),
    resetState,
    onOpenChange,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { handleCancel(); resetState(); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="w-5 h-5" />
            {step === 'preview' ? 'Confirm Installation' : 'Upload Plugins'}
          </DialogTitle>
          <DialogDescription>
            {step === 'preview'
              ? `Review ${previewItems.length} plugin(s) found in ${uploadedFileName}`
              : 'Upload a .zip, .tar, .gz, .gzip, or .tgz file containing plugins.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {step === 'upload' && (
            <>
              <UploadDialogDropZone
                uploading={uploading} isDragging={isDragging}
                onFileSelect={processFile} onDragStateChange={setIsDragging}
                onInvalidFile={() => setError('Invalid file type. Please upload a .zip, .tar, .gz, .gzip, or .tgz file.')}
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
              <UploadDialogPreviewItemsList items={previewItems} headerLabel="Items to install" maxHeightClass="max-h-[200px]" />
              <PluginUploadInstallationOptionsPanel />
              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg text-sm">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Archive analyzed successfully. Click <strong>Install</strong> to add these plugins.</span>
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
                <X className="w-4 h-4 mr-1" />Cancel
              </Button>
              <Button onClick={handleConfirmImport} disabled={uploading}>
                <Check className="w-4 h-4 mr-1" />Install {previewItems.length} Plugin(s)
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Cancel</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
