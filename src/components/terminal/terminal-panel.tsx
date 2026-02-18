'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTerminalStore } from '@/stores/terminal-store';
import { useProjectStore } from '@/stores/project-store';
import { useIsMobileViewport } from '@/hooks/use-mobile-viewport';
import { TerminalTabBar } from './terminal-tab-bar';
import { TerminalInstance } from './terminal-instance';
import { TerminalShortcutBar } from './terminal-shortcut-bar';
import { TerminalContextMenu } from './terminal-context-menu';

export function TerminalPanel() {
  const isOpen = useTerminalStore((s) => s.isOpen);
  const panelHeight = useTerminalStore((s) => s.panelHeight);
  const setPanelHeight = useTerminalStore((s) => s.setPanelHeight);
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const createTerminal = useTerminalStore((s) => s.createTerminal);
  const reconnectTabs = useTerminalStore((s) => s.reconnectTabs);
  const isCreating = useTerminalStore((s) => s._isCreating);

  const isMobile = useIsMobileViewport();

  // projectId is optional — terminal works globally, project path is best-effort
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const selectedProjectIds = useProjectStore((s) => s.selectedProjectIds);
  const projectId = activeProjectId || selectedProjectIds[0];

  const [isResizing, setIsResizing] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Create first terminal when panel first opens (or after all tabs are stale)
  const hasInitRef = useRef(false);
  useEffect(() => {
    if (!isOpen || hasInitRef.current) return;
    if (tabs.length > 0) {
      hasInitRef.current = true;
      return;
    }
    hasInitRef.current = true;
    setCreateFailed(false);
    createTerminal(projectId).then((id) => {
      if (!id) {
        hasInitRef.current = false;
        setCreateFailed(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // On mount (page load): reconnect persisted tabs to live PTY sessions
  const reconnectedRef = useRef(false);
  useEffect(() => {
    if (reconnectedRef.current || tabs.length === 0) return;
    reconnectedRef.current = true;
    reconnectTabs().then(() => {
      const currentTabs = useTerminalStore.getState().tabs;
      if (currentTabs.length === 0) hasInitRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetryCreate = useCallback(() => {
    setCreateFailed(false);
    createTerminal(projectId).then((id) => {
      if (!id) setCreateFailed(true);
    });
  }, [projectId, createTerminal]);

  // Resize start handler — supports both mouse and touch
  const startResize = useCallback(
    (clientY: number) => {
      startYRef.current = clientY;
      startHeightRef.current = panelHeight;
      setIsResizing(true);
    },
    [panelHeight]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startResize(e.clientY);
    },
    [startResize]
  );

  const handleResizeTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      startResize(e.touches[0].clientY);
    },
    [startResize]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startYRef.current;
      setPanelHeight(startHeightRef.current - deltaY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const deltaY = e.touches[0].clientY - startYRef.current;
      setPanelHeight(startHeightRef.current - deltaY);
    };

    const handleEnd = () => setIsResizing(false);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isResizing, setPanelHeight]);

  // Empty state when no tabs — loading or retry
  const emptyState = tabs.length === 0 && isOpen && (
    <div className="flex-1 flex items-center justify-center">
      {isCreating ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Creating terminal...</span>
        </div>
      ) : createFailed ? (
        <div className="flex flex-col items-center gap-3 text-sm">
          <p className="text-muted-foreground">Failed to create terminal</p>
          <Button variant="outline" size="sm" onClick={handleRetryCreate}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );

  // Track visual viewport so the panel shrinks when the mobile keyboard opens.
  // iOS Safari: keyboard overlays the layout viewport — `position: fixed` stays
  // anchored to the layout viewport. We need both `height` (visible area) and
  // `offsetTop` (how far the visual viewport has scrolled within the layout viewport)
  // to position the container exactly over the visible area above the keyboard.
  const mobileContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const vv = window.visualViewport;
    const el = mobileContainerRef.current;
    if (!vv || !el) return;

    const update = () => {
      el.style.height = `${vv.height}px`;
      el.style.top = `${vv.offsetTop}px`;
    };
    update();

    // resize: keyboard open/close; scroll: iOS viewport scroll within layout viewport
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    // Safari may not fire resize immediately — re-check after focus events
    const delayedUpdate = () => setTimeout(update, 300);
    document.addEventListener('focusin', delayedUpdate);
    document.addEventListener('focusout', delayedUpdate);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.removeEventListener('focusin', delayedUpdate);
      document.removeEventListener('focusout', delayedUpdate);
    };
  }, [isMobile, isOpen]);

  // Mobile: full-screen overlay
  if (isMobile) {
    return (
      <div
        ref={mobileContainerRef}
        className={cn(
          'fixed left-0 right-0 z-[60] flex flex-col bg-background',
          !isOpen && 'hidden'
        )}
        style={{ top: 0, height: '100%' }}
      >
        <TerminalTabBar projectId={projectId} />
        {tabs.length > 0 ? (
          <>
            <div className="flex-1 min-h-0 relative">
              {tabs.map((tab) => (
                <TerminalInstance
                  key={tab.id}
                  terminalId={tab.id}
                  isVisible={tab.id === activeTabId}
                  isMobile
                />
              ))}
            </div>
            <TerminalShortcutBar />
          </>
        ) : emptyState}
      </div>
    );
  }

  // Desktop: bottom panel with resize
  return (
    <div
      className={cn(
        'border-t bg-background flex flex-col shrink-0 overflow-hidden',
        isResizing && 'select-none',
        !isOpen && 'hidden'
      )}
      style={{ height: isOpen ? `${panelHeight}px` : 0 }}
    >
      {/* Resize handle */}
      <div
        className={cn(
          'h-1 cursor-row-resize hover:bg-primary/30 transition-colors',
          isResizing && 'bg-primary/30'
        )}
        onMouseDown={handleResizeMouseDown}
        onTouchStart={handleResizeTouchStart}
      />

      <TerminalTabBar projectId={projectId} />
      {tabs.length > 0 ? (
        <div className="flex-1 min-h-0 relative">
          {tabs.map((tab) => (
            <TerminalContextMenu key={tab.id} terminalId={tab.id}>
              <div className="absolute inset-0" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                <TerminalInstance
                  terminalId={tab.id}
                  isVisible={tab.id === activeTabId}
                />
              </div>
            </TerminalContextMenu>
          ))}
        </div>
      ) : emptyState}
    </div>
  );
}
