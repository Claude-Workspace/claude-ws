'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AtSign } from 'lucide-react';
import { EditorView } from '@codemirror/view';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface SelectionMentionPopupProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  editorViewRef: React.RefObject<any>;
  onAddToContext: (startLine: number, endLine: number) => void;
}

export function SelectionMentionPopup({
  containerRef,
  editorViewRef,
  onAddToContext,
}: SelectionMentionPopupProps) {
  const t = useTranslations('editor');
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<{ startLine: number; endLine: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getSelectionInfo = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return null;

    const sel = view.state.selection.main;
    if (sel.empty) return null; // No selection

    const doc = view.state.doc;
    const startLine = doc.lineAt(sel.from).number;
    const endLine = doc.lineAt(sel.to).number;

    return { startLine, endLine };
  }, [editorViewRef]);

  const updatePosition = useCallback(() => {
    const view = editorViewRef.current;
    const container = containerRef.current;
    if (!view || !container) return;

    const sel = view.state.selection.main;
    if (sel.empty) {
      setVisible(false);
      return;
    }

    // Get position at the end of selection
    const coords = view.coordsAtPos(sel.to);
    if (!coords) return;

    // Calculate position relative to container
    const containerRect = container.getBoundingClientRect();
    const x = coords.right - containerRect.left;
    const y = coords.bottom - containerRect.top;

    setPosition({ x, y });
    setVisible(true);
  }, [editorViewRef, containerRef]);

  const handleSelectionChange = useCallback(() => {
    const selectionInfo = getSelectionInfo();
    if (!selectionInfo) {
      setVisible(false);
      setSelection(null);
      return;
    }

    setSelection(selectionInfo);
    updatePosition();
  }, [getSelectionInfo, updatePosition]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    let currentTimeout: NodeJS.Timeout | null = null;

    const handleUpdate = (update: any) => {
      // Only care about selection changes
      if (!update.selectionSet) return;

      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      // Debounce the selection check
      if (currentTimeout) clearTimeout(currentTimeout);
      currentTimeout = setTimeout(() => {
        handleSelectionChange();
      }, 50);
    };

    // Create the listener extension
    const listenerExtension = EditorView.updateListener.of(handleUpdate);

    // Add the extension to the view
    view.dispatch({
      effects: [EditorView.scrollIntoView(0)]
    });

    // Subscribe to the view
    const subscription = view.subscribe(listenerExtension);

    return () => {
      if (currentTimeout) clearTimeout(currentTimeout);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      subscription?.();
    };
  }, [editorViewRef, handleSelectionChange]);

  const handleClick = useCallback(() => {
    if (!selection) return;
    onAddToContext(selection.startLine, selection.endLine);
    setVisible(false);
  }, [selection, onAddToContext]);

  if (!visible || !position || !selection) return null;

  const lineRange = selection.startLine === selection.endLine
    ? `L${selection.startLine}`
    : `L${selection.startLine}-${selection.endLine}`;

  return (
    <div
      ref={popupRef}
      className={cn(
        'fixed z-50 flex items-center gap-1 px-2 py-1',
        'bg-primary text-primary-foreground',
        'rounded-md shadow-lg',
        'cursor-pointer hover:bg-primary/90',
        'transition-opacity duration-150',
        'animate-in fade-in slide-in-from-bottom-1'
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y + 8}px`, // 8px below selection
        transform: 'translateX(-100%)', // Align to right
      }}
      onClick={handleClick}
      title={t('addLinesToChat', { startLine: selection.startLine, endLine: selection.endLine })}
    >
      <AtSign className="size-3" />
      <span className="text-xs font-medium">{lineRange}</span>
    </div>
  );
}
