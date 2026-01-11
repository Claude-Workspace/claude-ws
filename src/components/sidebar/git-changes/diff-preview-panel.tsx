'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical } from 'lucide-react';
import { DiffViewer } from './diff-viewer';
import { useSidebarStore } from '@/stores/sidebar-store';
import { cn } from '@/lib/utils';

const MIN_WIDTH = 300;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 560;
const MOBILE_BREAKPOINT = 768;

export function DiffPreviewPanel() {
  const { diffFile, diffStaged, closeDiff } = useSidebarStore();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const panelLeft = panelRef.current.getBoundingClientRect().left;
      const newWidth = e.clientX - panelLeft;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeDiff}
        />
        {/* Fullscreen panel */}
        <div
          ref={panelRef}
          className={cn(
            'fixed inset-0 z-50 bg-background flex flex-col',
            'animate-in slide-in-from-bottom duration-200'
          )}
        >
          <DiffViewer filePath={diffFile} staged={diffStaged} onClose={closeDiff} />
        </div>
      </>
    );
  }

  // Desktop: side panel
  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-r flex flex-col flex-1 relative',
        'animate-in slide-in-from-left duration-200',
        isResizing && 'select-none'
      )}
      style={{ minWidth: `${width}px` }}
    >
      <DiffViewer filePath={diffFile} staged={diffStaged} onClose={closeDiff} />

      {/* Resize handle - hidden on mobile */}
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-1.5 cursor-col-resize',
          'hover:bg-primary/20 active:bg-primary/30 transition-colors',
          'flex items-center justify-center group'
        )}
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="size-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
