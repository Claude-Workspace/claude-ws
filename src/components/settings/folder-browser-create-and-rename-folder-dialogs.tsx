'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
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

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  createName: string;
  isCreating: boolean;
  onCreateNameChange: (name: string) => void;
  onConfirm: () => void;
}

/**
 * Modal dialog for creating a new sub-folder inside the currently browsed directory.
 */
export function CreateFolderDialog({
  open,
  onOpenChange,
  currentPath,
  createName,
  isCreating,
  onCreateNameChange,
  onConfirm,
}: CreateFolderDialogProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isCreating) {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              ref={inputRef}
              value={createName}
              onChange={(e) => onCreateNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="new-folder"
              disabled={isCreating}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isCreating}>
            {isCreating ? tCommon('creating') : tCommon('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface RenameFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renameTarget: DirectoryEntry | null;
  renameName: string;
  isRenaming: boolean;
  onRenameNameChange: (name: string) => void;
  onConfirm: () => void;
}

/**
 * Modal dialog for renaming a folder inside the currently browsed directory.
 */
export function RenameFolderDialog({
  open,
  onOpenChange,
  renameTarget,
  renameName,
  isRenaming,
  onRenameNameChange,
  onConfirm,
}: RenameFolderDialogProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isRenaming) {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              ref={inputRef}
              value={renameName}
              onChange={(e) => onRenameNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="folder-name"
              disabled={isRenaming}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRenaming}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isRenaming}>
            {isRenaming ? tCommon('renaming') : tCommon('rename')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
