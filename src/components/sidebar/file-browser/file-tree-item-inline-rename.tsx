'use client';

import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { FileEntry } from '@/types';

interface FileTreeItemInlineRenameProps {
  entry: FileEntry;
  rootPath: string;
  renameValue: string;
  isSaving: boolean;
  onRenameValueChange: (value: string) => void;
  onCancel: () => void;
  onSuccess: () => void;
  onSavingChange: (saving: boolean) => void;
}

/**
 * FileTreeItemInlineRename - Inline text input for renaming a file or folder in the tree.
 * Submits on Enter, cancels on Escape or blur (when not saving).
 * Extracted from file-tree-item.tsx to keep it under 200 lines.
 */
export function FileTreeItemInlineRename({
  entry,
  rootPath,
  renameValue,
  isSaving,
  onRenameValueChange,
  onCancel,
  onSuccess,
  onSavingChange,
}: FileTreeItemInlineRenameProps) {
  const t = useTranslations('sidebar');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select text when mounted
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const submitRename = async () => {
    const trimmedName = renameValue.trim();
    if (!trimmedName) {
      toast.error(t('nameCannotBeEmpty'));
      return;
    }
    if (trimmedName === entry.name) {
      onCancel();
      return;
    }

    onSavingChange(true);
    try {
      const fullPath = `${rootPath}/${entry.path}`;
      const res = await fetch('/api/files/operations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath, rootPath, newName: trimmedName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('renameFailed'));
      }

      toast.success(t('renameSuccessful'));
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('renameFailed'));
      onRenameValueChange(entry.name);
    } finally {
      onSavingChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSaving) {
      e.preventDefault();
      submitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    if (!isSaving) onCancel();
  };

  return (
    <div className="flex-1 flex items-center gap-1">
      <Input
        ref={inputRef}
        value={renameValue}
        onChange={(e) => onRenameValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isSaving}
        className="h-6 px-2 py-0 text-sm bg-white dark:bg-slate-900 border-2 border-primary text-foreground dark:text-foreground"
        onClick={(e) => e.stopPropagation()}
      />
      {isSaving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
    </div>
  );
}
