'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FolderTree, GitBranch, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileTree } from './file-browser';
import { GitPanel } from './git-changes';
import { useSidebarStore } from '@/stores/sidebar-store';
import { cn } from '@/lib/utils';

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 280;

interface SidebarPanelProps {
  className?: string;
}

export function SidebarPanel({ className }: SidebarPanelProps) {
  const { isOpen, activeTab, setActiveTab, setIsOpen, sidebarWidth, setSidebarWidth } = useSidebarStore();
  const [width, setWidth] = useState(sidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

        <TabsContent value="files" className="flex-1 min-h-0 mt-0">
          <FileTree />
        </TabsContent>

        <TabsContent value="git" className="flex-1 min-h-0 mt-0">
          <GitPanel />
        </TabsContent>
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
