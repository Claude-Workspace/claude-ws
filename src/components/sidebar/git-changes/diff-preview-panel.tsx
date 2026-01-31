'use client';

import { useState, useEffect, useRef } from 'react';
import { DiffViewer } from './diff-viewer';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { useResizable } from '@/hooks/use-resizable';
import { useSidebarStore } from '@/stores/sidebar-store';
import { usePanelLayoutStore, PANEL_CONFIGS } from '@/stores/panel-layout-store';
import { useZIndexStore } from '@/stores/z-index-store';
import { cn } from '@/lib/utils';

const { minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH } = PANEL_CONFIGS.diffPreview;
const MOBILE_BREAKPOINT = 768;

export function DiffPreviewPanel() {
  const { diffFile, diffStaged, closeDiff } = useSidebarStore();
  const { widths, setWidth: setPanelWidth } = usePanelLayoutStore();
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Get z-index on mount for mobile fullscreen mode
  const [zIndex] = useState(() => useZIndexStore.getState().getNextZIndex());

  const { width, isResizing, handleMouseDown } = useResizable({
    initialWidth: widths.diffPreview,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    direction: 'right',
    onWidthChange: (w) => setPanelWidth('diffPreview', w),
  });

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!diffFile) return null;

  // Mobile: fullscreen popup with overlay
  if (isMobile) {
    return (
      <>
        {/* Overlay backdrop */}
        <div
          className="fixed inset-0 bg-black/50"
          style={{ zIndex }}
          onClick={closeDiff}
        />
        {/* Fullscreen panel */}
        <div
          ref={panelRef}
          className={cn(
            'fixed inset-0 bg-background flex flex-col',
            'animate-in slide-in-from-bottom duration-200'
          )}
          style={{ zIndex: zIndex + 1 }}
        >
          <DiffViewer filePath={diffFile} staged={diffStaged} onClose={closeDiff} />
        </div>
      </>
    );
  }

  // Desktop: side panel with fixed width and resize handle
  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-r flex flex-col relative shrink-0',
        'animate-in slide-in-from-left duration-200',
        isResizing && 'select-none'
      )}
      style={{ width: `${width}px` }}
    >
      <DiffViewer filePath={diffFile} staged={diffStaged} onClose={closeDiff} />

      {/* Resize handle */}
      <ResizeHandle
        position="right"
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
      />
    </div>
  );
}
