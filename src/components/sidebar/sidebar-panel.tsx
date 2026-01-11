'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FolderTree, GitBranch, X, GripVertical, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileTree } from './file-browser';
import { GitPanel } from './git-changes';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 280;

interface SidebarPanelProps {
  className?: string;
}

export function SidebarPanel({ className }: SidebarPanelProps) {
  const { isOpen, activeTab, setActiveTab, setIsOpen, sidebarWidth, setSidebarWidth } = useSidebarStore();
  const {
    projects,
    selectedProjectIds,
    activeProjectId,
    setActiveProjectId,
    getActiveProject,
    isAllProjectsMode,
    getSelectedProjects,
    loading: projectsLoading
  } = useProjectStore();
  const [width, setWidth] = useState(sidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Check if we're in multi-project mode (need to select a project for sidebar)
  const activeProject = getActiveProject();
  const isMultiSelect = isAllProjectsMode() || selectedProjectIds.length > 1;
  const availableProjects = getSelectedProjects();

  // Sync with store on mount
  useEffect(() => {
    setWidth(sidebarWidth);
  }, [sidebarWidth]);

  // Update store when resizing ends
  useEffect(() => {
    if (!isResizing && width !== sidebarWidth) {
      setSidebarWidth(width);
    }
  }, [width, isResizing, sidebarWidth, setSidebarWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
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

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        'h-full bg-background border-r flex flex-col shrink-0',
        'animate-in slide-in-from-left duration-200',
        isResizing && 'select-none',
        className
      )}
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Explorer</span>
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
          <TabsTrigger value="files" className="text-xs gap-1.5">
            <FolderTree className="size-3.5" />
            Files
          </TabsTrigger>
          <TabsTrigger value="git" className="text-xs gap-1.5">
            <GitBranch className="size-3.5" />
            Git
          </TabsTrigger>
        </TabsList>

        {/* Show loading when projects are loading and we have a saved activeProjectId */}
        {projectsLoading && activeProjectId && !activeProject ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : isMultiSelect && !activeProject ? (
          /* Show placeholder when multi-select without active project */
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <FolderOpen className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Select a project to browse files
            </p>
            <select
              className="w-full max-w-[200px] text-sm border rounded-md p-2 bg-background"
              value={activeProjectId || ''}
              onChange={(e) => setActiveProjectId(e.target.value || null)}
            >
              <option value="">Choose project...</option>
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
