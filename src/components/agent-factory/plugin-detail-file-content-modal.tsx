'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { File, Loader2, AlertCircle, Edit3, Save, X as XIcon } from 'lucide-react';
import hljs from 'highlight.js';
import { getFileIconColorClass } from '@/components/agent-factory/plugin-detail-file-icon-color-utils';

export interface FileContent {
  name: string;
  path: string;
  content: string;
  language: string;
  size: number;
}

interface PluginDetailFileContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileContent: FileContent | null;
  loadingContent: boolean;
  canEdit: boolean;
  pluginId?: string;
  error: string | null;
  setError: (error: string | null) => void;
  onContentSaved: (updatedContent: FileContent) => void;
}

export function PluginDetailFileContentModal({
  open,
  onOpenChange,
  fileContent,
  loadingContent,
  canEdit,
  pluginId,
  error,
  setError,
  onContentSaved,
}: PluginDetailFileContentModalProps) {
  const tCommon = useTranslations('common');
  const codeRef = useRef<HTMLElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fileContent && codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [fileContent]);

  useEffect(() => {
    if (open && fileContent) {
      const timer = setTimeout(() => {
        if (codeRef.current) hljs.highlightElement(codeRef.current);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, fileContent]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) { setIsEditing(false); setEditedContent(''); }
    onOpenChange(nextOpen);
  };

  const handleStartEdit = () => {
    if (fileContent) { setEditedContent(fileContent.content); setIsEditing(true); }
  };

  const handleCancelEdit = () => { setIsEditing(false); setEditedContent(''); };

  const handleSave = async () => {
    if (!pluginId || !fileContent) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-factory/plugins/${pluginId}/files/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: fileContent.path, content: editedContent }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save file');
      }
      onContentSaved({ ...fileContent, content: editedContent });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0"
        showCloseButton={false}
      >
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <File className={`w-5 h-5 flex-shrink-0 ${fileContent ? getFileIconColorClass(fileContent.name) : 'text-gray-500'}`} />
            <DialogTitle className="text-base truncate">
              {fileContent?.name || 'File'}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit && !isEditing && (
              <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={handleStartEdit}>
                <Edit3 className="w-3 h-3" />
                {tCommon('edit')}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onOpenChange(false)}>
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-[#0d1117]">
          {loadingContent ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : fileContent ? (
            isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-full min-h-[400px] p-4 font-mono text-sm bg-transparent border-0 focus-visible:ring-0 resize-none text-white"
                spellCheck={false}
                autoFocus
              />
            ) : (
              <pre className="text-sm p-4">
                <code ref={codeRef} className={`hljs language-${fileContent.language} block overflow-x-auto`}>
                  {fileContent.content}
                </code>
              </pre>
            )
          ) : null}
        </div>

        {fileContent && (
          isEditing ? (
            <div className="p-3 border-t bg-muted/30 flex items-center justify-between gap-2">
              {error && (
                <div className="flex items-center gap-1 text-destructive text-xs">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  <XIcon className="w-3 h-3 mr-1" />
                  {tCommon('cancel')}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !editedContent}>
                  {saving ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{tCommon('saving')}</>
                  ) : (
                    <><Save className="w-3 h-3 mr-1" />{tCommon('save')}</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground flex justify-between">
              <span className="capitalize">{fileContent.language}</span>
              <span>{(fileContent.size / 1024).toFixed(1)} KB</span>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
