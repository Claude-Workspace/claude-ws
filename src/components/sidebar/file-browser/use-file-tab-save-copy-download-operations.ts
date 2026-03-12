'use client';

import { useState, useCallback, useEffect } from 'react';
import type { FileContent } from './use-file-tab-state';

interface UseFileTabSaveCopyDownloadOperationsOptions {
  filePath: string;
  activeProjectPath: string | null | undefined;
  editedContent: string;
  isDirty: boolean;
  content: FileContent | null;
  fileName: string;
}

/**
 * useFileTabSaveCopyDownloadOperations - Handles save, copy-to-clipboard, and download
 * for the file tab editor. Extracted from use-file-tab-state to keep it under 200 lines.
 */
export function useFileTabSaveCopyDownloadOperations({
  filePath,
  activeProjectPath,
  editedContent,
  isDirty,
  content,
  fileName,
}: UseFileTabSaveCopyDownloadOperationsOptions) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Save file content to server
  const handleSave = useCallback(async () => {
    if (!isDirty || !filePath || !activeProjectPath) return;

    setSaveStatus('saving');
    try {
      const res = await fetch('/api/files/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePath: activeProjectPath,
          path: filePath,
          content: editedContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [isDirty, filePath, activeProjectPath, editedContent]);

  // Keyboard shortcut: Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && saveStatus !== 'saving') {
          handleSave();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, saveStatus, handleSave]);

  // Copy file content to clipboard
  const handleCopy = async () => {
    if (content?.content) {
      await navigator.clipboard.writeText(content.content);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setExportOpen(false);
      }, 500);
    }
  };

  // Trigger browser download of current file content
  const handleDownload = () => {
    if (content?.content) {
      const blob = new Blob([content.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return {
    saveStatus,
    setSaveStatus,
    copied,
    exportOpen,
    setExportOpen,
    handleSave,
    handleCopy,
    handleDownload,
  };
}
