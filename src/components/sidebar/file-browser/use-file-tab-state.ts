'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useActiveProject } from '@/hooks/use-active-project';
import { useFileSync } from '@/hooks/use-file-sync';
import { useTranslations } from 'next-intl';
import { useFileTabSearch } from '@/components/sidebar/file-browser/use-file-tab-search';
import { useFileTabUndoRedoHistory } from '@/components/sidebar/file-browser/use-file-tab-undo-redo-history';
import { useFileTabSaveCopyDownloadOperations } from '@/components/sidebar/file-browser/use-file-tab-save-copy-download-operations';
import { useFileTabAttachToChat } from '@/components/sidebar/file-browser/use-file-tab-attach-to-chat';
import { useFileTabContentLoader } from '@/components/sidebar/file-browser/use-file-tab-content-loader';

export interface FileContent {
  content: string | null;
  language: string | null;
  size: number;
  isBinary: boolean;
  mimeType: string;
}

interface UseFileTabStateOptions {
  tabId: string;
  filePath: string;
}

export function useFileTabState({ tabId, filePath }: UseFileTabStateOptions) {
  const activeProject = useActiveProject();
  const t = useTranslations('editor');
  const tCommon = useTranslations('common');
  const tSidebar = useTranslations('sidebar');
  const { editorPosition, setEditorPosition, updateTabDirty, pendingEditorPosition, clearPendingEditorPosition } = useSidebarStore();

  const isMarkdownFile = filePath.endsWith('.md') || filePath.endsWith('.mdx');

  const [viewMode, setViewMode] = useState<'preview' | 'code'>(() => {
    if (typeof window === 'undefined') return 'preview';
    return (localStorage.getItem('markdown-view-mode') as 'preview' | 'code') || 'preview';
  });

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const newMode = prev === 'preview' ? 'code' : 'preview';
      localStorage.setItem('markdown-view-mode', newMode);
      return newMode;
    });
  }, []);

  const [content, setContent] = useState<FileContent | null>(null);
  const [selection, setSelection] = useState<{ startLine: number; endLine: number } | null>(null);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const isDirty = originalContent !== editedContent;

  const undoRedo = useFileTabUndoRedoHistory({ editedContent, originalContent, setEditedContent });
  const search = useFileTabSearch({ editedContent });
  const fileName = filePath.split('/').pop() || filePath;

  const saveOps = useFileTabSaveCopyDownloadOperations({
    filePath, activeProjectPath: activeProject?.path,
    editedContent, isDirty, content, fileName,
  });

  const attachOps = useFileTabAttachToChat({
    filePath, activeProjectPath: activeProject?.path, selection,
    tSidebar: tSidebar as (key: string) => string,
    t: t as (key: string) => string,
  });

  // File content loader — extracted into use-file-tab-content-loader.ts
  const { loading, error } = useFileTabContentLoader({
    filePath,
    activeProjectPath: activeProject?.path,
    onLoaded: (data) => {
      setContent(data);
      setOriginalContent(data.content || '');
      setEditedContent(data.content || '');
      saveOps.setSaveStatus('idle');
      undoRedo.resetHistory();
    },
    onReset: () => {
      setContent(null);
      setOriginalContent('');
      setEditedContent('');
      saveOps.setSaveStatus('idle');
      undoRedo.resetHistory();
    },
  });

  // File sync - polls for external changes
  const [showDiffResolver, setShowDiffResolver] = useState(false);

  const fileSync = useFileSync({
    filePath: !loading && content && !content.isBinary ? filePath : null,
    basePath: activeProject?.path ?? null,
    currentContent: editedContent, originalContent,
    pollInterval: 5000,
    enabled: !loading && !!content && !content.isBinary,
    onRemoteChange: useCallback(() => { setShowDiffResolver(true); }, []),
    onSilentUpdate: useCallback((remoteContent: string) => {
      setEditedContent(remoteContent);
      setOriginalContent(remoteContent);
      undoRedo.resetHistory();
    }, [undoRedo]),
  });

  const handleAcceptRemote = useCallback(() => {
    if (fileSync.remoteContent !== null) {
      setEditedContent(fileSync.remoteContent);
      setOriginalContent(fileSync.remoteContent);
      undoRedo.resetHistory();
      fileSync.acceptRemote();
    }
  }, [fileSync, undoRedo]);

  const handleKeepLocal = useCallback(() => { fileSync.keepLocal(); }, [fileSync]);

  const handleMerge = useCallback((mergedContent: string) => {
    setEditedContent(mergedContent);
    undoRedo.pushToPast(editedContent);
    fileSync.clearConflict();
  }, [editedContent, fileSync, undoRedo]);

  useEffect(() => { updateTabDirty(tabId, isDirty); }, [tabId, isDirty, updateTabDirty]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => { setEditorPosition(null); }, [filePath, setEditorPosition]);

  useEffect(() => {
    if (pendingEditorPosition && pendingEditorPosition.filePath === filePath && !loading && content) {
      const timer = setTimeout(() => {
        setEditorPosition({
          lineNumber: pendingEditorPosition.lineNumber,
          column: pendingEditorPosition.column || 0,
          matchLength: pendingEditorPosition.matchLength || 0,
        });
        clearPendingEditorPosition();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pendingEditorPosition, filePath, loading, content, setEditorPosition, clearPendingEditorPosition]);

  const handleContentChange = useCallback((newContent: string) => { setEditedContent(newContent); }, []);

  return {
    activeProject, t, tCommon, tSidebar, fileName, isMarkdownFile,
    content, loading, error, editedContent, editorPosition, isDirty,
    saveStatus: saveOps.saveStatus,
    canUndo: undoRedo.canUndo, canRedo: undoRedo.canRedo,
    viewMode, toggleViewMode,
    ...search,
    selection, setSelection,
    copied: saveOps.copied, exportOpen: saveOps.exportOpen, setExportOpen: saveOps.setExportOpen,
    handleSave: saveOps.handleSave, handleUndo: undoRedo.handleUndo, handleRedo: undoRedo.handleRedo,
    handleContentChange, handleCopy: saveOps.handleCopy, handleDownload: saveOps.handleDownload,
    handleAttachToChat: attachOps.handleAttachToChat,
    fileSync, showDiffResolver, setShowDiffResolver,
    handleAcceptRemote, handleKeepLocal, handleMerge,
    selectedTask: attachOps.selectedTask, filePath,
  };
}
