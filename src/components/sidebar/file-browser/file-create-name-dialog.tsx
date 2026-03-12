'use client';

import { useState, useRef, useEffect } from 'react';
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
import type { FileEntry } from '@/types';

interface FileCreateNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createType: 'file' | 'folder';
  entry: FileEntry;
  fullPath: string;
  rootPath: string;
  onRefresh?: () => void;
  /** Label for the cancel button (defaults to "Cancel") */
  cancelLabel?: string;
  /** Label for the create button (defaults to "Create") */
  createLabel?: string;
}

/**
 * FileCreateNameDialog - Reusable dialog for naming and creating a new file or folder.
 * Calls the files/operations PATCH endpoint and opens the new file in the editor if it's a file.
 * Extracted from file-create-buttons.tsx to keep it under 200 lines.
 */
export function FileCreateNameDialog({
  open,
  onOpenChange,
  createType,
  entry,
  fullPath,
  rootPath,
  onRefresh,
  cancelLabel = 'Cancel',
  createLabel = 'Create',
}: FileCreateNameDialogProps) {
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openTab = useSidebarStore((state) => state.openTab);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setCreateName('');
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open]);

  const handleCreate = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      toast.error('Name cannot be empty');
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
      toast.success(`${createType === 'folder' ? 'Folder' : 'File'} created`);
      onOpenChange(false);
      onRefresh?.();

      if (createType === 'file' && data.path) {
        openTab(data.path);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isCreating) {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Create New {createType === 'folder' ? 'Folder' : 'File'}
          </DialogTitle>
          <DialogDescription>
            Enter a name for the new {createType} in{' '}
            <strong>{entry.name || 'root'}</strong>
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
              onKeyDown={handleKeyDown}
              placeholder={createType === 'folder' ? 'folder-name' : 'file-name.ts'}
              disabled={isCreating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            {cancelLabel}
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : createLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
