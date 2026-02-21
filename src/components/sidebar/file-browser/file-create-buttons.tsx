'use client';

import { useState, useRef, useEffect } from 'react';
import { FilePlus, FolderPlus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSidebarStore } from '@/stores/sidebar-store';
import { FileUploadDialog } from './file-upload-dialog';
import type { FileEntry } from '@/types';
import { useTranslations } from 'next-intl';

interface FileCreateButtonsProps {
  /** Parent directory entry where files/folders will be created */
  entry: FileEntry;
  /** Root path of the project */
  rootPath: string;
  /** Callback when file/folder is created successfully */
  onRefresh?: () => void;
}

/**
 * FileCreateButtons - Component with "Create File" and "Create Folder" buttons
 * Displays at the bottom of file tree for quick creation at project root
 */
export function FileCreateButtons({ entry, rootPath, onRefresh }: FileCreateButtonsProps) {
  const tSidebar = useTranslations('sidebar');
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openTab = useSidebarStore((state) => state.openTab);

  const fullPath = entry.path ? `${rootPath}/${entry.path}` : rootPath;

  // Focus input when dialog opens
  useEffect(() => {
    if (createDialogOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [createDialogOpen]);

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
      toast.error(tSidebar('nameCannotBeEmpty'));
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
        throw new Error(data.error || tSettings('createFailed'));
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
      toast.error(err instanceof Error ? err.message : tSettings('createFailed'));
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
      <div className="flex gap-2 w-full">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => openCreateDialog('file')}
        >
          <FilePlus className="mr-2 size-4" />
          File
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => openCreateDialog('folder')}
        >
          <FolderPlus className="mr-2 size-4" />
          Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setUploadDialogOpen(true)}
        >
          <Upload className="mr-2 size-4" />
          Upload
        </Button>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New {createType === 'folder' ? 'Folder' : 'File'}
            </DialogTitle>
            <DialogDescription>
              Enter a name for the new {createType === 'folder' ? 'folder' : 'file'} in <strong>{entry.name || 'root'}</strong>
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
              onClick={() => setCreateDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        targetPath={fullPath}
        rootPath={rootPath}
        targetName={entry.name || 'root'}
        onUploadSuccess={onRefresh}
      />
    </>
  );
}
