'use client';

import { useState } from 'react';
import { FilePlus, FolderPlus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUploadDialog } from './file-upload-dialog';
import { FileCreateNameDialog } from './file-create-name-dialog';
import type { FileEntry } from '@/types';

interface FileCreateButtonsProps {
  /** Parent directory entry where files/folders will be created */
  entry: FileEntry;
  /** Root path of the project */
  rootPath: string;
  /** Callback when file/folder is created successfully */
  onRefresh?: () => void;
}

/**
 * FileCreateButtons - "New File", "New Folder", and "Upload" buttons shown at the
 * bottom of the file tree for quick creation at the project root.
 * Dialog logic extracted into file-create-name-dialog.tsx.
 */
export function FileCreateButtons({ entry, rootPath, onRefresh }: FileCreateButtonsProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');

  const fullPath = entry.path ? `${rootPath}/${entry.path}` : rootPath;

  const openCreateDialog = (type: 'file' | 'folder') => {
    setCreateType(type);
    setCreateDialogOpen(true);
  };

  return (
    <>
      <div className="flex gap-1.5 w-full">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs px-2"
          onClick={() => openCreateDialog('file')}
        >
          <FilePlus className="mr-1 size-3.5" />
          File
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs px-2"
          onClick={() => openCreateDialog('folder')}
        >
          <FolderPlus className="mr-1 size-3.5" />
          Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs px-2"
          onClick={() => setUploadDialogOpen(true)}
        >
          <Upload className="mr-1 size-3.5" />
          Upload
        </Button>
      </div>

      {/* Create dialog — extracted into file-create-name-dialog.tsx */}
      <FileCreateNameDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        createType={createType}
        entry={entry}
        fullPath={fullPath}
        rootPath={rootPath}
        onRefresh={onRefresh}
      />

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
