'use client';

import { useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { FileTabContent } from './file-tab-content';
import { useResizable } from '@/hooks/use-resizable';
import { useSidebarStore } from '@/stores/sidebar-store';
import { usePanelLayoutStore, PANEL_CONFIGS } from '@/stores/panel-layout-store';
import { cn } from '@/lib/utils';

const { minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH } = PANEL_CONFIGS.filePreview;

export function FileTabsPanel() {
  const {
    openTabs,
    activeTabId,
    closeTab,
    closeAllTabs,
    setActiveTabId,
  } = useSidebarStore();
  const { widths, setWidth: setPanelWidth } = usePanelLayoutStore();
  const panelRef = useRef<HTMLDivElement>(null);

  const { width, isResizing, handleMouseDown } = useResizable({
    initialWidth: widths.filePreview,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    direction: 'right',
    onWidthChange: (w) => setPanelWidth('filePreview', w),
  });

  // Handle tab close with unsaved changes warning
  const handleCloseTab = useCallback((tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const tab = openTabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      const fileName = tab.filePath.split('/').pop() || tab.filePath;
      if (!confirm(`"${fileName}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }
    closeTab(tabId);
  }, [openTabs, closeTab]);

  // Handle close all tabs
  const handleCloseAllTabs = useCallback(() => {
    const dirtyTabs = openTabs.filter(t => t.isDirty);
    if (dirtyTabs.length > 0) {
      const fileNames = dirtyTabs.map(t => t.filePath.split('/').pop()).join(', ');
      if (!confirm(`You have unsaved changes in: ${fileNames}\n\nClose all tabs anyway?`)) {
        return;
      }
    }
    closeAllTabs();
  }, [openTabs, closeAllTabs]);

  // Note: Cmd+W keyboard shortcut is now handled globally in page.tsx

  // If no open tabs, don't render
  if (openTabs.length === 0) {
    return null;
  }

  const activeTab = openTabs.find(t => t.id === activeTabId);

  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-r flex flex-col relative',
        'w-full md:shrink-0', // Full width on mobile, shrink-0 on desktop
        isResizing && 'select-none'
      )}
      style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${width}px` : undefined }}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b bg-muted/30 shrink-0">
        <ScrollArea className="flex-1">
          <div className="flex items-center h-9">
            {openTabs.map((tab) => {
              const fileName = tab.filePath.split('/').pop() || tab.filePath;
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  onMouseUp={(e) => {
                    if (e.button === 1) { // Middle click
                      handleCloseTab(tab.id);
                    }
                  }}
                  className={cn(
                    'group flex items-center gap-1.5 h-full px-3 border-r cursor-pointer',
                    'hover:bg-accent/50 transition-colors',
                    isActive
                      ? 'bg-background border-b-2 border-b-primary'
                      : 'bg-transparent'
                  )}
                  title={tab.filePath}
                >
                  <span className={cn(
                    'text-sm truncate max-w-[150px]',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {fileName}
                  </span>
                  {tab.isDirty && (
                    <span className="text-amber-500 text-lg leading-none">•</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className={cn(
                      'size-5 p-0 opacity-0 group-hover:opacity-100',
                      'hover:bg-accent rounded-sm',
                      isActive && 'opacity-100'
                    )}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>

        {/* Close all button */}
        {openTabs.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloseAllTabs}
            className="text-xs text-muted-foreground h-8 px-2 mr-1"
            title="Close all tabs"
          >
            Close all
          </Button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab && (
          <FileTabContent
            key={activeTab.id}
            tabId={activeTab.id}
            filePath={activeTab.filePath}
          />
        )}
      </div>

      {/* Resize handle - hidden on mobile */}
      <div className="hidden md:block">
        <ResizeHandle
          position="right"
          onMouseDown={handleMouseDown}
          isResizing={isResizing}
        />
      </div>
    </div>
  );
}
