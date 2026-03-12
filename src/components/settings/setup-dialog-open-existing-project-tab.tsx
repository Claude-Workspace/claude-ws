'use client';

import { useTranslations } from 'next-intl';
import { FolderOpen, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SetupDialogOpenExistingProjectTabProps {
  path: string;
  name: string;
  error: string;
  loading: boolean;
  onPathChange: (path: string) => void;
  onBrowse: () => void;
  onCancel: () => void;
}

/**
 * Form content for the "Open Existing" tab inside SetupDialog.
 * Lets the user pick an existing project folder via the folder browser.
 */
export function SetupDialogOpenExistingProjectTab({
  path,
  name,
  error,
  loading,
  onPathChange,
  onBrowse,
  onCancel,
}: SetupDialogOpenExistingProjectTabProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <label htmlFor="path-open" className="text-sm font-medium">
          {t('projectFolder')}
        </label>
        <div className="flex gap-2">
          <div
            className="relative flex-1 cursor-pointer"
            onClick={() => !loading && onBrowse()}
          >
            <FolderOpen className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="path-open"
              value={path}
              onChange={(e) => onPathChange(e.target.value)}
              placeholder="/path/to/project"
              className="pl-8 cursor-pointer"
              disabled={loading}
              readOnly
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onBrowse}
            disabled={loading}
          >
            {tCommon('browse')}
          </Button>
        </div>
        {path && (
          <p className="text-xs text-muted-foreground">
            {t('projectName')}: <span className="font-medium">{name || t('autoDetected')}</span>
          </p>
        )}
      </div>

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
        <Button type="submit" disabled={loading || !path}>
          {loading ? tCommon('opening') : t('openProject')}
        </Button>
      </div>
    </div>
  );
}
