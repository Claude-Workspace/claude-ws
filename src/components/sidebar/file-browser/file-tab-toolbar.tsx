'use client';

import { Loader2, AlertCircle, Copy, Check, Save, Undo, Redo, Search, Download, Eye, Code, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslations } from 'next-intl';
import type { FileContent } from '@/components/sidebar/file-browser/use-file-tab-state';
import type { FileSyncState } from '@/hooks/use-file-sync';
import { FileTabToolbarAttachToChatButton } from './file-tab-toolbar-attach-to-chat-button';

// Re-export FileTabSearchBar from its own module for convenience
export { FileTabSearchBar } from './file-tab-search-bar';

type TranslationFn = ReturnType<typeof useTranslations>;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileTabToolbarProps {
  fileName: string;
  content: FileContent | null;
  isMarkdownFile: boolean;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  canUndo: boolean;
  canRedo: boolean;
  handleUndo: () => void;
  handleRedo: () => void;
  handleSave: () => void;
  viewMode: 'preview' | 'code';
  toggleViewMode: () => void;
  searchVisible: boolean;
  setSearchVisible: (visible: boolean) => void;
  selection: { startLine: number; endLine: number } | null;
  selectedTask: { id: string } | null;
  handleAttachToChat: (createNew?: boolean) => void;
  copied: boolean;
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  handleCopy: () => void;
  handleDownload: () => void;
  fileSync: Pick<FileSyncState, 'isPolling' | 'hasConflict'>;
  setShowDiffResolver: (show: boolean) => void;
  t: TranslationFn;
  tCommon: TranslationFn;
}

export function FileTabToolbar({
  fileName, content, isMarkdownFile, isDirty, saveStatus,
  canUndo, canRedo, handleUndo, handleRedo, handleSave,
  viewMode, toggleViewMode, searchVisible, setSearchVisible,
  selection, selectedTask, handleAttachToChat,
  copied, exportOpen, setExportOpen, handleCopy, handleDownload,
  fileSync, setShowDiffResolver, t, tCommon,
}: FileTabToolbarProps) {
  const isEditable = !content?.isBinary && content?.content !== null;

  return (
    <div className="flex items-center justify-between px-2 sm:px-3 py-2 border-b shrink-0 gap-1 overflow-x-auto overflow-y-hidden">
      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 relative min-w-0">
        {saveStatus === 'saving' && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {saveStatus === 'saved' && <Check className="size-4 text-green-500" />}
        {saveStatus === 'error' && <AlertCircle className="size-4 text-destructive" />}

        {isEditable && (
          <>
            <Button variant="ghost" size="icon-sm" onClick={() => setSearchVisible(!searchVisible)}
              title={t('searchPlaceholder') + ' (⌘F)'} className={searchVisible ? 'bg-accent' : ''}>
              <Search className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleUndo} disabled={!canUndo} title={t('undo') + ' (⌘Z)'}>
              <Undo className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleRedo} disabled={!canRedo} title={t('redo') + ' (⌘⇧Z)'}>
              <Redo className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSave}
              disabled={!isDirty || saveStatus === 'saving'} title={tCommon('save') + ' (⌘S)'} className="text-xs gap-1">
              <Save className="size-3" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            {isMarkdownFile && (
              <Button variant="ghost" size="icon-sm" onClick={toggleViewMode}
                title={viewMode === 'preview' ? t('showSourceCode') : t('showPreview')}
                className={viewMode === 'preview' ? 'bg-accent' : ''}>
                {viewMode === 'preview' ? <Code className="size-4" /> : <Eye className="size-4" />}
              </Button>
            )}
            {/* Attach to chat — extracted into file-tab-toolbar-attach-to-chat-button.tsx */}
            <FileTabToolbarAttachToChatButton
              selection={selection}
              selectedTask={selectedTask}
              handleAttachToChat={handleAttachToChat}
              t={t}
            />
          </>
        )}

        {content && (
          <span className="text-xs text-muted-foreground hidden sm:inline">{formatFileSize(content.size)}</span>
        )}

        {content?.content && (
          <DropdownMenu open={exportOpen} onOpenChange={setExportOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" title={t('export')}>
                <Download className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopy}>
                {copied ? <Check className="size-4 mr-2 text-green-500" /> : <Copy className="size-4 mr-2" />}
                <span className="text-sm">{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="size-4 mr-2" />
                <span className="text-sm">Download</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
        {fileSync.isPolling && (
          <span title={t('checkingForChanges')}>
            <RefreshCw className="size-3 animate-spin text-muted-foreground" />
          </span>
        )}
        {fileSync.hasConflict && (
          <Button variant="ghost" size="sm" onClick={() => setShowDiffResolver(true)}
            className="text-xs gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-400"
            title={t('externalChangesDetected')}>
            <AlertCircle className="size-3" />
            <span className="hidden sm:inline">Conflict</span>
          </Button>
        )}
        <span className="text-sm font-medium truncate">{fileName}</span>
        {isDirty && (
          <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded hidden sm:inline-block">
            Modified
          </span>
        )}
      </div>
    </div>
  );
}
