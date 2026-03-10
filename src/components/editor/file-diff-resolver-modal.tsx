'use client';

/**
 * File Diff Resolver Modal
 *
 * Shows a modal when file changes are detected on disk while the user
 * has unsaved local changes. Displays side-by-side comparison with
 * interactive "Insert" buttons on changed remote lines to merge
 * specific changes into local content.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Copy, ArrowLeft, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { computeDiffBlocks } from '@/components/editor/diff-algorithm';
import { DiffPanelLocal } from '@/components/editor/diff-panel-local';
import { DiffPanelRemote } from '@/components/editor/diff-panel-remote';

interface FileDiffResolverModalProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  localContent: string;
  remoteContent: string;
  onAcceptRemote: () => void;
  onKeepLocal: () => void;
  onMerge: (mergedContent: string) => void;
}

export function FileDiffResolverModal({
  open,
  onClose,
  filePath,
  localContent,
  remoteContent,
  onAcceptRemote,
  onKeepLocal,
  onMerge,
}: FileDiffResolverModalProps) {
  const t = useTranslations('editor');

  // Working copy of local content that user can modify via inserts
  const [workingContent, setWorkingContent] = useState(localContent);
  const localScrollRef = useRef<HTMLDivElement>(null);
  const remoteScrollRef = useRef<HTMLDivElement>(null);

  // Reset working content when modal opens with new content
  useEffect(() => {
    if (open) {
      setWorkingContent(localContent);
    }
  }, [open, localContent]);

  const diffBlocks = useMemo(() => {
    return computeDiffBlocks(workingContent, remoteContent);
  }, [workingContent, remoteContent]);

  const hasChanges = useMemo(() => {
    return diffBlocks.some(block => block.type !== 'unchanged');
  }, [diffBlocks]);

  // Insert a remote line at a specific position in working content
  const handleInsertLine = useCallback((remoteLine: string, insertAfterLocalLine: number) => {
    const lines = workingContent.split('\n');
    lines.splice(insertAfterLocalLine, 0, '>>>>> REMOTE', remoteLine);
    setWorkingContent(lines.join('\n'));
    toast.success(t('lineInserted'));
  }, [workingContent, t]);

  // Insert all lines from a remote block
  const handleInsertBlock = useCallback((remoteLines: string[], insertAfterLocalLine: number) => {
    const lines = workingContent.split('\n');
    lines.splice(insertAfterLocalLine, 0, '>>>>> REMOTE', ...remoteLines, '<<<<< END REMOTE');
    setWorkingContent(lines.join('\n'));
    toast.success(t('linesInserted', { count: remoteLines.length }));
  }, [workingContent, t]);

  // Insert deletion marker for lines that exist in local but not remote
  const handleInsertDeletedMarker = useCallback((startPosition: number, lineCount: number) => {
    const lines = workingContent.split('\n');
    // Insert end marker AFTER all the deleted lines
    lines.splice(startPosition + lineCount, 0, '<<<<< END REMOTE DELETED');
    // Insert start marker BEFORE the deleted lines
    lines.splice(startPosition, 0, '>>>>> REMOTE DELETED');
    setWorkingContent(lines.join('\n'));
    toast.success(lineCount > 1 ? t('deletionMarkersInserted') : t('deletionMarkerInserted'));
  }, [workingContent, t]);

  const handleKeepLocal = useCallback(() => {
    onKeepLocal();
    onClose();
    toast.success(t('keptLocalChanges'));
  }, [onKeepLocal, onClose, t]);

  const handleAcceptRemote = useCallback(() => {
    onAcceptRemote();
    onClose();
    toast.success(t('acceptedRemoteChanges'));
  }, [onAcceptRemote, onClose, t]);

  const handleApplyMerged = useCallback(() => {
    onMerge(workingContent);
    onClose();
    toast.success(t('appliedMergedChanges'));
  }, [workingContent, onMerge, onClose, t]);

  const handleCopy = useCallback(async (content: string, label: string) => {
    await navigator.clipboard.writeText(content);
    toast.success(t('copiedToClipboard', { label }));
  }, [t]);

  // Sync scroll between panels
  const handleScroll = useCallback((source: 'local' | 'remote') => {
    const sourceRef = source === 'local' ? localScrollRef : remoteScrollRef;
    const targetRef = source === 'local' ? remoteScrollRef : localScrollRef;

    if (sourceRef.current && targetRef.current) {
      targetRef.current.scrollTop = sourceRef.current.scrollTop;
    }
  }, []);

  const fileName = filePath.split('/').pop() || filePath;
  const hasLocalModifications = workingContent !== localContent;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            {t('fileChangedExternally')}
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{fileName}</span>
            {' '}{t('hasBeenModified')} <Plus className="inline size-3" /> {t('toInsertRemoteLines')}
          </DialogDescription>
        </DialogHeader>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{t('differences')}</span>
          {hasChanges ? (
            <>
              <span className="text-blue-600 dark:text-blue-400">
                {diffBlocks.filter(b => b.type === 'added').reduce((sum, b) => sum + b.remoteLines.length, 0)} {t('newInRemote')}
              </span>
              <span className="text-green-600 dark:text-green-400">
                {diffBlocks.filter(b => b.type === 'removed').reduce((sum, b) => sum + b.localLines.length, 0)} {t('onlyInLocal')}
              </span>
            </>
          ) : (
            <span className="text-green-600 dark:text-green-400">{t('filesIdentical')}</span>
          )}
          {hasLocalModifications && (
            <span className="text-amber-600 dark:text-amber-400 ml-auto text-xs">
              {t('modifiedFromOriginal')}
            </span>
          )}
        </div>

        {/* Side-by-side diff view */}
        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
          {/* Local/Working (left) */}
          <div className="flex flex-col border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
              <span className="text-xs font-medium text-muted-foreground">
                {t('local')} {hasLocalModifications && t('modified')}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleCopy(workingContent, 'local content')}
                title={t('copyLocalContent')}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <div
              ref={localScrollRef}
              className="flex-1 overflow-auto font-mono text-xs"
              onScroll={() => handleScroll('local')}
            >
              <DiffPanelLocal diffBlocks={diffBlocks} />
            </div>
          </div>

          {/* Remote (right) */}
          <div className="flex flex-col border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
              <span className="text-xs font-medium text-muted-foreground">{t('remoteDisk')}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleCopy(remoteContent, 'remote content')}
                title={t('copyRemoteContent')}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <div
              ref={remoteScrollRef}
              className="flex-1 overflow-auto font-mono text-xs"
              onScroll={() => handleScroll('remote')}
            >
              <DiffPanelRemote
                diffBlocks={diffBlocks}
                onInsertLine={handleInsertLine}
                onInsertBlock={handleInsertBlock}
                onInsertDeletedMarker={handleInsertDeletedMarker}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="outline" onClick={handleKeepLocal} className="gap-2">
            <ArrowLeft className="size-4" />
            {t('keepLocalOnly')}
          </Button>
          <Button variant="outline" onClick={handleAcceptRemote} className="gap-2">
            {t('acceptRemoteOnly')}
          </Button>
          {hasLocalModifications && (
            <Button variant="default" onClick={handleApplyMerged} className="gap-2">
              <Check className="size-4" />
              {t('applyMerged')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
