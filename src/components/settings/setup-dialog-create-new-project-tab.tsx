'use client';

import { useTranslations } from 'next-intl';
import { Folder, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SetupDialogCreateNewProjectTabProps {
  name: string;
  rootPath: string;
  fullProjectPath: string;
  error: string;
  loading: boolean;
  onNameChange: (name: string) => void;
  onRootPathChange: (path: string) => void;
  onBrowseRoot: () => void;
  onCancel: () => void;
}

/**
 * Form content for the "Create New" tab inside SetupDialog.
 * Collects project name and parent root folder, then previews the full path.
 */
export function SetupDialogCreateNewProjectTab({
  name,
  rootPath,
  fullProjectPath,
  error,
  loading,
  onNameChange,
  onRootPathChange,
  onBrowseRoot,
  onCancel,
}: SetupDialogCreateNewProjectTabProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          {t('projectName')}
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="my-kanban"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">{t('folderNameHint')}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="root-path" className="text-sm font-medium">
          {t('rootFolder')}
        </label>
        <div className="flex gap-2">
          <div
            className="relative flex-1 cursor-pointer"
            onClick={() => !loading && onBrowseRoot()}
          >
            <Folder className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="root-path"
              value={rootPath}
              onChange={(e) => onRootPathChange(e.target.value)}
              placeholder="/home/user/projects"
              className="pl-8 cursor-pointer"
              disabled={loading}
              readOnly
            />
          </div>
          <Button type="button" variant="outline" onClick={onBrowseRoot} disabled={loading}>
            {tCommon('browse')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('selectParentFolder')}</p>
      </div>

      {fullProjectPath && (
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('projectCreatedAt')}</label>
          <div className="p-3 bg-muted rounded-md text-sm font-mono break-all">
            {fullProjectPath}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={loading || !name || !rootPath}>
          {loading ? tCommon('creating') : t('createProject')}
        </Button>
      </div>
    </div>
  );
}
