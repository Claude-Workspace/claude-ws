'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FolderOpen as FolderOpenIcon, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/project-store';
import { FolderBrowserDialog } from '@/components/settings/folder-browser-dialog';
import { sanitizeDirName } from '@/lib/file-utils';
import { SetupDialogOpenExistingProjectTab } from '@/components/settings/setup-dialog-open-existing-project-tab';
import { SetupDialogCreateNewProjectTab } from '@/components/settings/setup-dialog-create-new-project-tab';

type Mode = 'create' | 'open';
type BrowserMode = 'root' | 'project';

interface SetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetupDialog({ open, onOpenChange }: SetupDialogProps) {
  const t = useTranslations('settings');
  const { createProject, setCurrentProject } = useProjectStore();
  const [mode, setMode] = useState<Mode>('open');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);
  const [browserMode, setBrowserMode] = useState<BrowserMode>('project');

  useEffect(() => {
    if (open) { setMode('open'); setName(''); setPath(''); setRootPath(''); setError(''); }
  }, [open]);

  const dirName = sanitizeDirName(name);
  const fullProjectPath = dirName && rootPath ? `${rootPath}/${dirName}` : '';

  const handleFolderSelect = (selectedPath: string) => {
    if (browserMode === 'root') {
      setRootPath(selectedPath);
    } else {
      setPath(selectedPath);
      if (mode === 'open' && !name) {
        setName(selectedPath.split('/').filter(Boolean).pop() || '');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError(t('projectNameRequired')); return; }

    let finalPath = path;
    if (mode === 'create') {
      if (!rootPath.trim()) { setError(t('rootFolderRequired')); return; }
      const sanitizedName = sanitizeDirName(name);
      if (!sanitizedName) { setError(t('projectNameAlphanumeric')); return; }
      finalPath = `${rootPath.trim()}/${sanitizedName}`;
    } else {
      if (!path.trim()) { setError(t('projectPathRequired')); return; }
    }

    if (!finalPath.startsWith('/') && !finalPath.match(/^[A-Za-z]:\\/)) {
      setError(t('enterAbsolutePath')); return;
    }

    setLoading(true);
    try {
      const project = await createProject({ name: name.trim(), path: finalPath.trim() });
      if (project) { setCurrentProject(project); setName(''); setPath(''); setRootPath(''); onOpenChange(false); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally { setLoading(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('setUpProject')}</DialogTitle>
            <DialogDescription>
              {mode === 'open' ? t('selectExistingDescription') : t('configureNewDescription')}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1.5">
              <TabsTrigger value="open" className="[&[data-state=active]]:![background-color:rgba(255,255,255,0.2)]">
                <FolderOpenIcon className="h-4 w-4" />{t('openExisting')}
              </TabsTrigger>
              <TabsTrigger value="create" className="[&[data-state=active]]:![background-color:rgba(255,255,255,0.2)]">
                <Plus className="h-4 w-4" />{t('createNew')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="mt-4">
              <form onSubmit={handleSubmit}>
                <SetupDialogOpenExistingProjectTab
                  path={path} name={name} error={error} loading={loading}
                  onPathChange={setPath}
                  onBrowse={() => { setBrowserMode('project'); setFolderBrowserOpen(true); }}
                  onCancel={() => onOpenChange(false)}
                />
              </form>
            </TabsContent>

            <TabsContent value="create" className="mt-4">
              <form onSubmit={handleSubmit}>
                <SetupDialogCreateNewProjectTab
                  name={name} rootPath={rootPath} fullProjectPath={fullProjectPath}
                  error={error} loading={loading}
                  onNameChange={setName} onRootPathChange={setRootPath}
                  onBrowseRoot={() => { setBrowserMode('root'); setFolderBrowserOpen(true); }}
                  onCancel={() => onOpenChange(false)}
                />
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <FolderBrowserDialog
        open={folderBrowserOpen}
        onOpenChange={setFolderBrowserOpen}
        onSelect={handleFolderSelect}
      />
    </>
  );
}
