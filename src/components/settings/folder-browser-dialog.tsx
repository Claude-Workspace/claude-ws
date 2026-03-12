'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, Home, RefreshCw, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FolderBrowserDirectoryListing } from '@/components/settings/folder-browser-directory-listing';
import {
  CreateFolderDialog,
  RenameFolderDialog,
} from '@/components/settings/folder-browser-create-and-rename-folder-dialogs';

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface FolderBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function FolderBrowserDialog({ open, onOpenChange, onSelect, initialPath }: FolderBrowserDialogProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tSidebar = useTranslations('sidebar');
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [homePath, setHomePath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualPath, setManualPath] = useState('');

  // Create folder dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Rename folder dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameTarget, setRenameTarget] = useState<DirectoryEntry | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const fetchDirectory = async (path?: string) => {
    setLoading(true); setError('');
    try {
      const url = path ? `/api/filesystem?path=${encodeURIComponent(path)}` : '/api/filesystem';
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load directory');
      setCurrentPath(data.currentPath);
      setDirectories(data.directories);
      setParentPath(data.parentPath);
      setHomePath(data.homePath);
      setManualPath(data.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) fetchDirectory(initialPath || undefined); }, [open, initialPath]);

  const handleCreate = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) { toast.error(tSidebar('nameCannotBeEmpty')); return; }
    setIsCreating(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath: currentPath, rootPath: currentPath, name: trimmedName, type: 'folder' }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Create failed'); }
      toast.success(t('folderCreated'));
      setCreateDialogOpen(false);
      fetchDirectory(currentPath);
    } catch (err) { toast.error(err instanceof Error ? err.message : t('createFailed')); }
    finally { setIsCreating(false); }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const trimmedName = renameName.trim();
    if (!trimmedName) { toast.error(tSidebar('nameCannotBeEmpty')); return; }
    if (trimmedName === renameTarget.name) { setRenameDialogOpen(false); return; }
    setIsRenaming(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: renameTarget.path, rootPath: currentPath, newName: trimmedName }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Rename failed'); }
      toast.success(t('folderRenamed'));
      setRenameDialogOpen(false);
      fetchDirectory(currentPath);
    } catch (err) { toast.error(err instanceof Error ? err.message : t('renameFailed')); }
    finally { setIsRenaming(false); }
  };

  const openRenameDialog = (dir: DirectoryEntry) => {
    setRenameTarget(dir); setRenameName(dir.name); setRenameDialogOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('selectFolder')}</DialogTitle>
          <DialogDescription>{t('navigateAndSelect')}</DialogDescription>
        </DialogHeader>

        {/* Manual path input */}
        <form onSubmit={(e) => { e.preventDefault(); if (manualPath.trim()) fetchDirectory(manualPath.trim()); }} className="flex gap-2">
          <Input value={manualPath} onChange={(e) => setManualPath(e.target.value)} placeholder="/path/to/folder" className="flex-1" />
          <Button type="submit" variant="outline" size="icon" disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </form>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => parentPath && fetchDirectory(parentPath)} disabled={!parentPath || loading}>
            <ChevronUp className="h-4 w-4 mr-1" />{t('up')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchDirectory(homePath)} disabled={loading}>
            <Home className="h-4 w-4 mr-1" />{t('home')}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => { setCreateName(''); setCreateDialogOpen(true); }} disabled={loading || !currentPath}>
            <FolderPlus className="h-4 w-4 mr-1" />{t('createNewFolder')}
          </Button>
        </div>

        {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">{error}</div>}

        <FolderBrowserDirectoryListing
          loading={loading}
          directories={directories}
          onNavigate={fetchDirectory}
          onRename={openRenameDialog}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tCommon('cancel')}</Button>
          <Button onClick={() => { onSelect(currentPath); onOpenChange(false); }} disabled={!currentPath}>
            {t('selectThisFolder')}
          </Button>
        </div>
      </DialogContent>

      <CreateFolderDialog
        open={createDialogOpen} onOpenChange={setCreateDialogOpen}
        currentPath={currentPath} createName={createName}
        isCreating={isCreating} onCreateNameChange={setCreateName} onConfirm={handleCreate}
      />

      <RenameFolderDialog
        open={renameDialogOpen} onOpenChange={setRenameDialogOpen}
        renameTarget={renameTarget} renameName={renameName}
        isRenaming={isRenaming} onRenameNameChange={setRenameName} onConfirm={handleRename}
      />
    </Dialog>
  );
}
