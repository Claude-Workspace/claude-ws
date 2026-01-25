'use client';

import { useState } from 'react';
import { Trash, Download, Copy, Loader2, FileText } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSidebarStore } from '@/stores/sidebar-store';
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
  /** Child element that triggers the context menu */
  children: React.ReactNode;
}

export function FileTreeContextMenu({
  entry,
  rootPath,
  onDelete,
  onRename,
  children,
}: FileTreeContextMenuProps) {
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const closeTabByFilePath = useSidebarStore((state) => state.closeTabByFilePath);

  const fullPath = `${rootPath}/${entry.path}`;

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
    `${entry.type === 'directory' ? 'Folder' : 'File'} deleted`
      );
      setDeleteDialog(false);
      onDelete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
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

      toast.success('Download started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
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
      toast.success('Path copied to clipboard');
    } catch {
      toast.error('Failed to copy path');
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Download
            {isDownloading && <span className="ml-auto text-xs text-muted-foreground">Preparing...</span>}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopyPath}>
            <Copy className="mr-2 size-4" />
            Copy Path
          </ContextMenuItem>
          <ContextMenuItem onClick={onRename}>
            <FileText className="mr-2 size-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => setDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash className="mr-2 size-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {entry.type === 'directory' ? 'Folder' : 'File'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{entry.name}</strong>
              {entry.type === 'directory' && ' and all its contents'}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
