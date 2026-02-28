'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Folder,
  ChevronUp,
  Home,
  Loader2,
  RefreshCw,
  FolderPlus,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

export function FolderBrowserDialog({
  open,
  onOpenChange,
  onSelect,
  initialPath,
}: FolderBrowserDialogProps) {
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
  const createInputRef = useRef<HTMLInputElement>(null);

  // Rename folder dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameTarget, setRenameTarget] = useState<DirectoryEntry | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const fetchDirectory = async (path?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = path
        ? `/api/filesystem?path=${encodeURIComponent(path)}`
        : '/api/filesystem';
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load directory');
      }

      setCurrentPath(data.currentPath);
      setDirectories(data.directories);
      setParentPath(data.parentPath);
      setHomePath(data.homePath);
      setManualPath(data.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDirectory(initialPath || undefined);
    }
  }, [open, initialPath]);

  const handleNavigate = (path: string) => {
    fetchDirectory(path);
  };

  const handleGoUp = () => {
    if (parentPath) {
      fetchDirectory(parentPath);
    }
  };

  const handleGoHome = () => {
    fetchDirectory(homePath);
  };

  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPath.trim()) {
      fetchDirectory(manualPath.trim());
    }
  };

  const handleSelect = () => {
    onSelect(currentPath);
    onOpenChange(false);
  };

  // Focus input when create dialog opens
  useEffect(() => {
    if (createDialogOpen && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [createDialogOpen]);

  // Focus input when rename dialog opens
  useEffect(() => {
    if (renameDialogOpen && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameDialogOpen]);

  /**
   * Open create folder dialog
   */
  const openCreateDialog = () => {
    setCreateName('');
    setCreateDialogOpen(true);
  };

  /**
   * Handle create folder submission
   */
  const handleCreate = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      toast.error(tSidebar('nameCannotBeEmpty'));
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPath: currentPath,
          rootPath: currentPath, // Use currentPath as root for browsing context
          name: trimmedName,
          type: 'folder',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Create failed');
      }

      toast.success(t('folderCreated'));
      setCreateDialogOpen(false);
      // Refresh directory listing
      fetchDirectory(currentPath);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isCreating) {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCreateDialogOpen(false);
    }
  };

  /**
   * Open rename folder dialog
   */
  const openRenameDialog = (dir: DirectoryEntry) => {
    setRenameTarget(dir);
    setRenameName(dir.name);
    setRenameDialogOpen(true);
  };

  /**
   * Handle rename folder submission
   */
  const handleRename = async () => {
    if (!renameTarget) return;

    const trimmedName = renameName.trim();
    if (!trimmedName) {
      toast.error(tSidebar('nameCannotBeEmpty'));
      return;
    }

    if (trimmedName === renameTarget.name) {
      setRenameDialogOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: renameTarget.path,
          rootPath: currentPath, // Use currentPath as root for browsing context
          newName: trimmedName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Rename failed');
      }

      toast.success(t('folderRenamed'));
      setRenameDialogOpen(false);
      // Refresh directory listing
      fetchDirectory(currentPath);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('renameFailed'));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isRenaming) {
      e.preventDefault();
      handleRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setRenameDialogOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('selectFolder')}</DialogTitle>
          <DialogDescription>
            {t('navigateAndSelect')}
          </DialogDescription>
        </DialogHeader>

        {/* Manual path input */}
        <form onSubmit={handleManualPathSubmit} className="flex gap-2">
          <Input
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            placeholder="/path/to/folder"
            className="flex-1"
          />
          <Button type="submit" variant="outline" size="icon" disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </form>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoUp}
            disabled={!parentPath || loading}
          >
            <ChevronUp className="h-4 w-4 mr-1" />
            {t('up')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoHome}
            disabled={loading}
          >
            <Home className="h-4 w-4 mr-1" />
            {t('home')}
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={openCreateDialog}
            disabled={loading || !currentPath}
          >
            <FolderPlus className="h-4 w-4 mr-1" />
            {t('createNewFolder')}
          </Button>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
            {error}
          </div>
        )}

        {/* Directory listing */}
        <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : directories.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                {t('noSubdirectories')}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {directories.map((dir) => (
                  <div
                    key={dir.path}
                    className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <button
                      onClick={() => handleNavigate(dir.path)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="truncate">{dir.name}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameDialog(dir);
                      }}
                      title={t('renameFolderTitle')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSelect} disabled={!currentPath}>
            {t('selectThisFolder')}
          </Button>
        </div>
      </DialogContent>

      {/* Create Folder Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createNewFolder')}</DialogTitle>
            <DialogDescription>
              {t('enterFolderNameIn')} <strong>{currentPath.split('/').pop() || currentPath}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-folder-name">{t('folderName')}</Label>
              <Input
                id="create-folder-name"
                ref={createInputRef}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                placeholder="new-folder"
                disabled={isCreating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isCreating}
            >
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? tCommon('creating') : tCommon('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('renameFolder')}</DialogTitle>
            <DialogDescription>
              {t('enterNewNameFor')} <strong>{renameTarget?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-folder-name">{t('newName')}</Label>
              <Input
                id="rename-folder-name"
                ref={renameInputRef}
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                placeholder="folder-name"
                disabled={isRenaming}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={isRenaming}
            >
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleRename} disabled={isRenaming}>
              {isRenaming ? tCommon('renaming') : tCommon('rename')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
