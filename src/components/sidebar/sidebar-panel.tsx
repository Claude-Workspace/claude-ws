'use client';

import { useRef } from 'react';
import { FolderTree, GitBranch, X, FolderOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileTree } from './file-browser';
import { GitPanel } from './git-changes';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { useResizable } from '@/hooks/use-resizable';
import { useSidebarStore } from '@/stores/sidebar-store';
import { usePanelLayoutStore, PANEL_CONFIGS } from '@/stores/panel-layout-store';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';

const { minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH } = PANEL_CONFIGS.leftSidebar;

interface SidebarPanelProps {
  className?: string;
}

export function SidebarPanel({ className }: SidebarPanelProps) {
  const t = useTranslations('sidebar');
  const { isOpen, activeTab, setActiveTab, setIsOpen } = useSidebarStore();
  const { widths, setWidth: setPanelWidth } = usePanelLayoutStore();
  const {
    projects,
    selectedProjectIds,
    activeProjectId,
    setActiveProjectId,
    getActiveProject,
    isAllProjectsMode,
    getSelectedProjects
  } = useProjectStore();
  const panelRef = useRef<HTMLDivElement>(null);

  const { width, isResizing, handleMouseDown } = useResizable({
    initialWidth: widths.leftSidebar,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    direction: 'right',
    onWidthChange: (w) => setPanelWidth('leftSidebar', w),
  });

  // Check if we're in multi-project mode (need to select a project for sidebar)
  const activeProject = getActiveProject();
  const isMultiSelect = isAllProjectsMode() || selectedProjectIds.length > 1;
  const availableProjects = getSelectedProjects();

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-r flex flex-col shrink-0 relative',
        'animate-in slide-in-from-left duration-200',
        isResizing && 'select-none',
        className
      )}
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">{t('explorer')}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setIsOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'files' | 'git')}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="grid w-full grid-cols-2 h-9 mx-2 mt-2" style={{ width: 'calc(100% - 16px)' }}>
          <TabsTrigger
            value="files"
            className="text-xs gap-1.5"
            onMouseUp={(e) => {
              if (e.button === 1) { // Middle click
                setIsOpen(false);
              }
            }}
          >
            <FolderTree className="size-3.5" />
            {t('files')}
          </TabsTrigger>
          <TabsTrigger
            value="git"
            className="text-xs gap-1.5"
            onMouseUp={(e) => {
              if (e.button === 1) { // Middle click
                setIsOpen(false);
              }
            }}
          >
            <GitBranch className="size-3.5" />
            {t('git')}
          </TabsTrigger>
        </TabsList>

        {isMultiSelect && !activeProject ? (
          /* Show placeholder when multi-select without active project */
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <FolderOpen className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              {t('selectProjectToBrowse')}
            </p>
            <select
              className="w-full max-w-[200px] text-sm border rounded-md p-2 bg-background"
              value={activeProjectId || ''}
              onChange={(e) => setActiveProjectId(e.target.value || null)}
            >
              <option value="">{t('chooseProject')}</option>
              {availableProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <TabsContent value="files" className="flex-1 min-h-0 mt-0">
              <FileTree />
            </TabsContent>

            <TabsContent value="git" className="flex-1 min-h-0 mt-0">
              <GitPanel />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Resize handle */}
      <ResizeHandle
        position="right"
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
      />
    </div>
  );
}
