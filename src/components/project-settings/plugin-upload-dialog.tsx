'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Upload, FileArchive, Loader2, AlertCircle, Package, FileText, Folder, Check, X } from 'lucide-react';

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

/**
 * Plugin upload dialog for project settings.
 * Allows uploading plugins with options to:
 * - Install to this project
 * - Import to agent factory as well
 */
export function PluginUploadDialog({ open, onOpenChange, projectId, onUploadSuccess }: PluginUploadDialogProps) {
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = async (file: File) => {
    // Validate file extension
    const validExtensions = ['.zip', '.tar', '.gz', '.gzip', '.tgz'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExtension) {
      setError('Invalid file type. Please upload a .zip, .tar, .gz, .gzip, or .tgz file.');
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

      setSessionId(data.sessionId);
      setPreviewItems(data.items || []);
      setUploadedFileName(file.name);
      setStep('preview');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleConfirmImport = async () => {
    if (!sessionId) {
      setError('Session expired. Please upload the file again.');
      return;
    }

    setStep('importing');
    setError(null);

    try {
      // Step 1: Always import to agent factory first (required to get plugin IDs in database)
      // The sync API requires plugins to exist in the database
      const importRes = await fetch('/api/agent-factory/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          confirm: true,
          globalImport: false, // Always import to agent factory to get DB IDs
        }),
      });

      if (!importRes.ok) {
        const data = await importRes.json();
        throw new Error(data.error || 'Failed to import plugins');
      }

      // Step 2: Fetch plugins to get IDs matching the imported names
      const pluginsRes = await fetch('/api/agent-factory/plugins', {
        headers: {
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
      });

      if (!pluginsRes.ok) {
        throw new Error('Failed to fetch plugins after import');
      }

      const pluginsData = await pluginsRes.json();
      const importedNames = previewItems.map(item => item.name);

      // Find matching plugin IDs
      const matchedPluginIds = (pluginsData.plugins || [])
        .filter((p: { name: string }) => importedNames.includes(p.name))
        .map((p: { id: string }) => p.id);

      if (matchedPluginIds.length === 0) {
        throw new Error('No plugins found after import. Please try again.');
      }

      // Step 3: Get current project settings
      const currentSettingsRes = await fetch(`/api/projects/${projectId}/settings`, {
        headers: {
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
      });

      let currentComponents: string[] = [];
      let currentAgentSets: string[] = [];

      if (currentSettingsRes.ok) {
        const currentSettings = await currentSettingsRes.json();
        currentComponents = currentSettings.settings?.selectedComponents || [];
        currentAgentSets = currentSettings.settings?.selectedAgentSets || [];
      }

      // Merge new IDs with existing (avoid duplicates)
      const newComponents = [...new Set([...currentComponents, ...matchedPluginIds])];

      // Step 4: Update project settings
      const updateSettingsRes = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
        body: JSON.stringify({
          settings: {
            selectedComponents: newComponents,
            selectedAgentSets: currentAgentSets,
          },
        }),
      });

      if (!updateSettingsRes.ok) {
        console.warn('Failed to update project settings, but import was successful');
      }

      // Step 5: Sync (install) components to project folder
      const syncRes = await fetch(`/api/agent-factory/projects/${projectId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
      });

      if (!syncRes.ok) {
        console.warn('Failed to sync components to project folder, but import was successful');
      }

      // Close dialog and trigger refresh
      onOpenChange(false);
      resetState();
      onUploadSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
      setStep('preview');
    }
  };

  const handleCancel = async () => {
    if (sessionId) {
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
    await processFile(file);
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
        handleCancel();
        resetState();
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="w-5 h-5" />
            {step === 'preview' ? 'Confirm Installation' : 'Upload Plugins'}
          </DialogTitle>
          <DialogDescription>
            {step === 'preview'
              ? `Review ${previewItems.length} plugin(s) found in ${uploadedFileName}`
              : 'Upload a .zip, .tar, .gz, .gzip, or .tgz file containing plugins.'
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
                    <p className="text-muted-foreground">Analyzing archive...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-12 h-12 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        .zip, .tar, .gz, .gzip, or .tgz files
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
                <p className="font-medium mb-2">Automatic Organization:</p>
                <p className="text-xs mb-2">
                  Files will be automatically organized into the correct folders:
                </p>
                <ul className="text-xs space-y-1 ml-4">
                  <li>• <strong>Skills:</strong> Folders with <code>SKILL.md</code> → <code>skills/</code></li>
                  <li>• <strong>Commands:</strong> <code>@command</code> or command-type files → <code>commands/</code></li>
                  <li>• <strong>Agents:</strong> <code>@agent</code> or agent-type files → <code>agents/</code></li>
                </ul>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              {/* Preview List */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-sm font-medium border-b">
                  Items to install ({previewItems.length})
                </div>
                <div className="max-h-[200px] overflow-y-auto">
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

              {/* Installation options */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Installation Options:</p>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="install-to-project"
                    checked={true}
                    disabled={true}
                  />
                  <div className="flex-1">
                    <Label htmlFor="install-to-project" className="text-sm font-medium">
                      Install to this project
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Plugins will be installed to the project's .claude folder
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="import-to-factory"
                    checked={true}
                    disabled={true}
                  />
                  <div className="flex-1">
                    <Label htmlFor="import-to-factory" className="text-sm font-medium">
                      Import to Agent Factory
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Plugins are automatically added to your plugin pool for reuse
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Success info */}
              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg text-sm">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Archive analyzed successfully. Click <strong>Install</strong> to add these plugins.
                </span>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Installing plugins...</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === 'preview' ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={uploading}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button onClick={handleConfirmImport} disabled={uploading}>
                <Check className="w-4 h-4 mr-1" />
                Install {previewItems.length} Plugin(s)
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
