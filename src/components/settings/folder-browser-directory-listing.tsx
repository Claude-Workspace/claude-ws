'use client';

import { Folder, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface FolderBrowserDirectoryListingProps {
  loading: boolean;
  directories: DirectoryEntry[];
  onNavigate: (path: string) => void;
  onRename: (dir: DirectoryEntry) => void;
}

/**
 * Scrollable list of sub-directories inside the folder browser dialog.
 * Handles loading/empty states and emits navigate/rename events per entry.
 */
export function FolderBrowserDirectoryListing({
  loading,
  directories,
  onNavigate,
  onRename,
}: FolderBrowserDirectoryListingProps) {
  const t = useTranslations('settings');

  return (
    <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
      <ScrollArea className="h-full">
        {loading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : directories.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            {t('noSubdirectories')}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {directories.map((dir) => (
              <div
                key={dir.path}
                className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
              >
                <button
                  onClick={() => onNavigate(dir.path)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="truncate">{dir.name}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename(dir);
                  }}
                  title={t('renameFolderTitle')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
