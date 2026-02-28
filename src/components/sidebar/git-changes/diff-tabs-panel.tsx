'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { DiffViewer } from './diff-viewer';
import { useResizable } from '@/hooks/use-resizable';
import { useSidebarStore } from '@/stores/sidebar-store';
import { usePanelLayoutStore, PANEL_CONFIGS } from '@/stores/panel-layout-store';
import { cn } from '@/lib/utils';

const { minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH } = PANEL_CONFIGS.diffPreview;

export function DiffTabsPanel() {
  const t = useTranslations('git');
  const {
    diffTabs,
    activeDiffTabId,
    closeDiffTab,
    closeAllDiffTabs,
    setActiveDiffTabId,
  } = useSidebarStore();
  const { widths, setWidth: setPanelWidth } = usePanelLayoutStore();
  const panelRef = useRef<HTMLDivElement>(null);

  const { width, isResizing, handleMouseDown } = useResizable({
    initialWidth: widths.diffPreview,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    direction: 'right',
    onWidthChange: (w) => setPanelWidth('diffPreview', w),
  });

  // If no open diff tabs, don't render
  if (diffTabs.length === 0) {
    return null;
  }

  const activeTab = diffTabs.find(t => t.id === activeDiffTabId);

  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-r flex flex-col relative shrink-0',
        isResizing && 'select-none'
      )}
      style={{ width: `${width}px` }}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b bg-muted/30 shrink-0">
        <div
          className="flex-1 min-w-0 overflow-x-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border) / 0.5) transparent' }}
        >
          <div className="flex items-center h-9 w-max">
            {diffTabs.map((tab) => {
              const fileName = tab.filePath.split('/').pop() || tab.filePath;
              const isActive = tab.id === activeDiffTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveDiffTabId(tab.id)}
                  onMouseUp={(e) => {
                    if (e.button === 1) { // Middle click
                      closeDiffTab(tab.id);
                    }
                  }}
                  className={cn(
                    'group flex items-center gap-1.5 h-full px-3 border-r cursor-pointer shrink-0',
                    'hover:bg-accent/50 transition-colors',
                    isActive
                      ? 'bg-background border-b-2 border-b-primary'
                      : 'bg-transparent'
                  )}
                  title={`${tab.filePath} (${tab.staged ? 'staged' : 'unstaged'})`}
                >
                  <span className={cn(
                    'text-sm whitespace-nowrap',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {fileName}
                  </span>
                  <span className={cn(
                    'text-xs px-1 py-0.5 rounded shrink-0',
                    tab.staged ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  )}>
                    {tab.staged ? 'S' : 'U'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeDiffTab(tab.id);
                    }}
                    className={cn(
                      'size-5 p-0 opacity-0 group-hover:opacity-100 shrink-0',
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
        </div>

        {/* Close all button */}
        {diffTabs.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={closeAllDiffTabs}
            className="text-xs text-muted-foreground h-8 px-2 mr-1"
            title={t('closeAllTabs')}
          >
            Close all
          </Button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab && (
          <DiffViewer
            key={activeTab.id}
            filePath={activeTab.filePath}
            staged={activeTab.staged}
            onClose={() => closeDiffTab(activeTab.id)}
          />
        )}
      </div>

      {/* Resize handle */}
      <ResizeHandle
        position="right"
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
      />
    </div>
  );
}
