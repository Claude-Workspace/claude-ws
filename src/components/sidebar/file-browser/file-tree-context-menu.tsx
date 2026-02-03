'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash, Download, Copy, Loader2, FileText, FilePlus, FolderPlus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSidebarStore } from '@/stores/sidebar-store';
import { FileUploadDialog } from './file-upload-dialog';
import type { FileEntry } from '@/types';

interface FileTreeContextMenuProps {
  /** File or folder entry to show context menu for */
  entry: FileEntry;
  /** Root path of the project (for path validation) */
  rootPath: string;
  /** Callback when file is deleted successfully */
  onDelete?: () => void;
  /** Callback to trigger inline rename */
  onRename?: () => void;
  /** Callback when file/folder is created successfully */
  onRefresh?: () => void;
  /** Child element that triggers the context menu */
  children: React.ReactNode;
}

interface FileTreeContextMenuContentProps {
  entry: FileEntry;
  rootPath: string;
  onDelete?: () => void;
  onRename?: () => void;
  onRefresh?: () => void;
  itemType?: 'context' | 'dropdown';
}

export function FileTreeContextMenuContent({
  entry,
  rootPath,
  onDelete,
  onRename,
  onRefresh,
  itemType = 'context',
}: FileTreeContextMenuContentProps) {
  const t = useTranslations('sidebar');
  const tCommon = useTranslations('common');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [createName, setCreateName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openTab = useSidebarStore((state) => state.openTab);
  const closeTabByFilePath = useSidebarStore((state) => state.closeTabByFilePath);

  const fullPath = `${rootPath}/${entry.path}`;
  const isDirectory = entry.type === 'directory';

  // Select the appropriate item component based on type
  const MenuItem = itemType === 'context' ? ContextMenuItem : DropdownMenuItem;
  const MenuSeparator = itemType === 'context' ? ContextMenuSeparator : DropdownMenuSeparator;

  // Focus input when dialog opens
  useEffect(() => {
    if (createDialogOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [createDialogOpen]);

  /**
   * Handle file/folder deletion with confirmation
   */
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath, rootPath }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }

      // Close tab if file is open in editor
      if (entry.type === 'file') {
        closeTabByFilePath(fullPath);
      }

      toast.success(
    entry.type === 'directory' ? t('folderDeleted') : t('fileDeleted')
      );
      setDeleteDialog(false);
      onDelete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle file/folder download
   * - Files: download directly without ZIP
   * - Folders: download as ZIP archive
   */
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath, rootPath }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Download failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        // Use .zip extension for folders, original filename for files
        a.download = entry.type === 'directory'
          ? `${entry.name}.zip`
          : entry.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        URL.revokeObjectURL(url);
      }

      toast.success(t('downloadStarted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deleteFailed'));
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Copy absolute file path to clipboard
   */
  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(fullPath);
      toast.success(t('pathCopied'));
    } catch {
      toast.error(t('failedToCopyPath'));
    }
  };

  /**
   * Open create dialog for file or folder
   */
  const openCreateDialog = (type: 'file' | 'folder') => {
    setCreateType(type);
    setCreateName('');
    setCreateDialogOpen(true);
  };

  /**
   * Handle create file/folder submission
   */
  const handleCreate = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      toast.error(t('nameCannotBeEmpty'));
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPath: fullPath,
          rootPath,
          name: trimmedName,
          type: createType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Create failed');
      }

      const data = await res.json();

      toast.success(
        `${createType === 'folder' ? 'Folder' : 'File'} created`
      );

      setCreateDialogOpen(false);

      // Refresh file tree
      onRefresh?.();

      // If created a file, open it in editor
      if (createType === 'file' && data.path) {
        openTab(data.path);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
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

  return (
    <>
      {/* Show create options only for directories */}
      {isDirectory && (
        <>
          <MenuItem onClick={(e) => { e.preventDefault(); openCreateDialog('file'); }}>
            <FilePlus className="mr-2 size-4" />
            {t('newFile')}
          </MenuItem>
          <MenuItem onClick={(e) => { e.preventDefault(); openCreateDialog('folder'); }}>
            <FolderPlus className="mr-2 size-4" />
            {t('newFolder')}
          </MenuItem>
          <MenuItem onClick={(e) => { e.preventDefault(); setUploadDialogOpen(true); }}>
            <Upload className="mr-2 size-4" />
            {t('uploadFiles')}
          </MenuItem>
          <MenuSeparator />
        </>
      )}

      <MenuItem onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Download className="mr-2 size-4" />
        )}
        {t('download')}
        {isDownloading && <span className="ml-auto text-xs text-muted-foreground">Preparing...</span>}
      </MenuItem>
      <MenuItem onClick={handleCopyPath}>
        <Copy className="mr-2 size-4" />
        {t('copyPath')}
      </MenuItem>
      <MenuItem onClick={onRename}>
        <FileText className="mr-2 size-4" />
        {t('rename')}
      </MenuItem>
      <MenuItem
        onClick={(e) => {
          e.preventDefault();
          setDeleteDialog(true);
        }}
        className="text-destructive focus:text-destructive"
      >
        <Trash className="mr-2 size-4" />
        {t('delete')}
      </MenuItem>

      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('delete')} {entry.type === 'directory' ? t('newFolder').toLowerCase() : t('newFile').toLowerCase().replace('new ', '')}
            </DialogTitle>
            <DialogDescription>
              {t('deleteConfirm', { name: entry.name })}
              {entry.type === 'directory' && ' and all its contents'}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
<<<<<<< HEAD
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              {t('cancel')}
=======
            <Button
              variant="outline"
              value="cancel"
              onClick={() => setDeleteDialog(false)}
              disabled={isDeleting}
            >
              {tCommon('cancel')}
>>>>>>> 438de82cdec074da9b2e4445999abee4b86d54c0
            </Button>
            <Button
              variant="destructive"
              value="delete"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('create')} {createType === 'folder' ? t('newFolder') : t('newFile')}
            </DialogTitle>
            <DialogDescription>
              {createType === 'file'
                ? t('createFile', { name: createName || '...', location: entry.name })
                : t('createFolder', { name: createName || '...', location: entry.name })
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                ref={inputRef}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                placeholder={createType === 'folder' ? 'folder-name' : 'file-name.ts'}
                disabled={isCreating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              value="cancel"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isCreating}
            >
<<<<<<< HEAD
              {t('cancel')}
=======
              {tCommon('cancel')}
>>>>>>> 438de82cdec074da9b2e4445999abee4b86d54c0
            </Button>
            <Button
              value="create"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog - only for directories */}
      {isDirectory && (
        <FileUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          targetPath={fullPath}
          rootPath={rootPath}
          targetName={entry.name}
          onUploadSuccess={onRefresh}
        />
      )}
    </>
  );
}

export function FileTreeContextMenu({
  entry,
  rootPath,
  onDelete,
  onRename,
  onRefresh,
  children,
}: FileTreeContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <FileTreeContextMenuContent
          entry={entry}
          rootPath={rootPath}
          onDelete={onDelete}
          onRename={onRename}
          onRefresh={onRefresh}
          itemType="context"
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
