'use client';

import { useState } from 'react';
import { Download, Copy, Loader2, FileText, FilePlus, FolderPlus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { FileUploadDialog } from './file-upload-dialog';
import { DeleteDialog, CreateDialog } from './file-tree-context-menu-dialogs';
import type { FileEntry } from '@/types';

interface FileTreeContextMenuProps {
  entry: FileEntry;
  rootPath: string;
  onDelete?: () => void;
  onRename?: () => void;
  onRefresh?: () => void;
  children: React.ReactNode;
}

export interface FileTreeContextMenuContentProps {
  entry: FileEntry;
  rootPath: string;
  onDelete?: () => void;
  onRename?: () => void;
  onRefresh?: () => void;
  itemType?: 'context' | 'dropdown';
}

export function FileTreeContextMenuContent({
  entry, rootPath, onDelete, onRename, onRefresh, itemType = 'context',
}: FileTreeContextMenuContentProps) {
  const t = useTranslations('sidebar');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [isDownloading, setIsDownloading] = useState(false);

  const fullPath = `${rootPath}/${entry.path}`;
  const isDirectory = entry.type === 'directory';
  const MenuItem = itemType === 'context' ? ContextMenuItem : DropdownMenuItem;
  const MenuSeparator = itemType === 'context' ? ContextMenuSeparator : DropdownMenuSeparator;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath, rootPath }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Download failed'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = entry.type === 'directory' ? `${entry.name}.zip` : entry.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } finally { URL.revokeObjectURL(url); }
      toast.success(t('downloadStarted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deleteFailed'));
    } finally { setIsDownloading(false); }
  };

  const handleCopyPath = async () => {
    try { await navigator.clipboard.writeText(fullPath); toast.success(t('pathCopied')); }
    catch { toast.error(t('failedToCopyPath')); }
  };

  return (
    <>
      {isDirectory && (
        <>
          <MenuItem onClick={(e) => { e.preventDefault(); setCreateType('file'); setCreateDialogOpen(true); }}>
            <FilePlus className="mr-2 size-4" />{t('newFile')}
          </MenuItem>
          <MenuItem onClick={(e) => { e.preventDefault(); setCreateType('folder'); setCreateDialogOpen(true); }}>
            <FolderPlus className="mr-2 size-4" />{t('newFolder')}
          </MenuItem>
          <MenuItem onClick={(e) => { e.preventDefault(); setUploadDialogOpen(true); }}>
            <Upload className="mr-2 size-4" />{t('uploadFiles')}
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      <MenuItem onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
        {t('download')}
        {isDownloading && <span className="ml-auto text-xs text-muted-foreground">Preparing...</span>}
      </MenuItem>
      <MenuItem onClick={handleCopyPath}><Copy className="mr-2 size-4" />{t('copyPath')}</MenuItem>
      <MenuItem onClick={onRename}><FileText className="mr-2 size-4" />{t('rename')}</MenuItem>
      <MenuItem onClick={(e) => { e.preventDefault(); setDeleteDialog(true); }} className="text-destructive focus:text-destructive">
        {t('delete')}
      </MenuItem>

      <DeleteDialog open={deleteDialog} onOpenChange={setDeleteDialog}
        entry={entry} fullPath={fullPath} rootPath={rootPath} onDelete={onDelete} />
      <CreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}
        createType={createType} entry={entry} fullPath={fullPath} rootPath={rootPath} onRefresh={onRefresh} />
      {isDirectory && (
        <FileUploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}
          targetPath={fullPath} rootPath={rootPath} targetName={entry.name} onUploadSuccess={onRefresh} />
      )}
    </>
  );
}

/**
 * FileTreeContextMenu - Right-click context menu wrapper for file/folder tree items.
 * Menu content (actions + dialogs) lives in FileTreeContextMenuContent.
 */
export function FileTreeContextMenu({ entry, rootPath, onDelete, onRename, onRefresh, children }: FileTreeContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <FileTreeContextMenuContent entry={entry} rootPath={rootPath}
          onDelete={onDelete} onRename={onRename} onRefresh={onRefresh} itemType="context" />
      </ContextMenuContent>
    </ContextMenu>
  );
}
