'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSidebarStore } from '@/stores/sidebar-store';
import type { FileEntry } from '@/types';
import { useTranslations } from 'next-intl';

// --- Delete Dialog ---

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FileEntry;
  fullPath: string;
  rootPath: string;
  onDelete?: () => void;
}

/**
 * DeleteDialog - Confirms and executes file/folder deletion via the files/operations API.
 */
export function DeleteDialog({ open, onOpenChange, entry, fullPath, rootPath, onDelete }: DeleteDialogProps) {
  const t = useTranslations('sidebar');
  const [isDeleting, setIsDeleting] = useState(false);
  const closeTabByFilePath = useSidebarStore((s) => s.closeTabByFilePath);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath, rootPath }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      if (entry.type === 'file') closeTabByFilePath(fullPath);
      toast.success(entry.type === 'directory' ? t('folderDeleted') : t('fileDeleted'));
      onOpenChange(false);
      onDelete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deleteFailed'));
    } finally { setIsDeleting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('delete')} {entry.type === 'directory' ? t('newFolder').toLowerCase() : t('newFile').toLowerCase().replace('new ', '')}
          </DialogTitle>
          <DialogDescription>
            {t('deleteConfirm', { name: entry.name })}
            {entry.type === 'directory' && ' and all its contents'}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Create File/Folder Dialog ---

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createType: 'file' | 'folder';
  entry: FileEntry;
  fullPath: string;
  rootPath: string;
  onRefresh?: () => void;
}

/**
 * CreateDialog - Dialog for naming and creating a new file or folder inside a directory.
 */
export function CreateDialog({ open, onOpenChange, createType, entry, fullPath, rootPath, onRefresh }: CreateDialogProps) {
  const t = useTranslations('sidebar');
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openTab = useSidebarStore((s) => s.openTab);

  useEffect(() => {
    if (open && inputRef.current) { setCreateName(''); inputRef.current.focus(); inputRef.current.select(); }
  }, [open]);

  const handleCreate = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) { toast.error(t('nameCannotBeEmpty')); return; }
    setIsCreating(true);
    try {
      const res = await fetch('/api/files/operations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath: fullPath, rootPath, name: trimmedName, type: createType }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Create failed'); }
      const data = await res.json();
      toast.success(`${createType === 'folder' ? 'Folder' : 'File'} created`);
      onOpenChange(false);
      onRefresh?.();
      if (createType === 'file' && data.path) openTab(data.path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally { setIsCreating(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isCreating) { e.preventDefault(); handleCreate(); }
    else if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('create')} {createType === 'folder' ? t('newFolder') : t('newFile')}</DialogTitle>
          <DialogDescription>
            {createType === 'file'
              ? t('createFile', { name: createName || '...', location: entry.name })
              : t('createFolder', { name: createName || '...', location: entry.name })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Name</Label>
            <Input id="create-name" ref={inputRef} value={createName}
              onChange={(e) => setCreateName(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={createType === 'folder' ? 'folder-name' : 'file-name.ts'} disabled={isCreating} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>{t('cancel')}</Button>
          <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? 'Creating...' : t('create')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
