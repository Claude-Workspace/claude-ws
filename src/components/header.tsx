'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Settings, Plus, Search, PanelLeft, PanelRight, FolderTree, Sun, Moon } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTaskStore } from '@/stores/task-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useRightSidebarStore } from '@/stores/right-sidebar-store';
import { useShellStore } from '@/stores/shell-store';
import { useProjectStore } from '@/stores/project-store';
import { ProjectSelector, ProjectSelectorContent } from '@/components/header/project-selector';

interface HeaderProps {
  onCreateTask: () => void;
  onOpenSettings: () => void;
  onAddProject: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function Header({ onCreateTask, onOpenSettings, onAddProject, searchQuery: externalSearchQuery = '', onSearchChange }: HeaderProps) {
  const { tasks } = useTaskStore();
  const { isOpen: sidebarOpen, toggleSidebar } = useSidebarStore();
  const { isOpen: rightSidebarOpen, toggleRightSidebar } = useRightSidebarStore();
  const { shells } = useShellStore();
  const { activeProjectId, selectedProjectIds } = useProjectStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchChange || setInternalSearchQuery;
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  // Count running shells for current project
  const currentProjectId = activeProjectId || selectedProjectIds[0];
  const runningShellCount = currentProjectId
    ? Array.from(shells.values()).filter(
        (s) => s.projectId === currentProjectId && s.isRunning
      ).length
    : 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-2 px-2 sm:gap-4 sm:px-4">
        {/* Left sidebar toggle - file management */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={sidebarOpen ? 'secondary' : 'ghost'}
                size="icon"
                onClick={toggleSidebar}
                className="shrink-0"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle sidebar (⌘B)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Logo - full text on desktop, icon only on mobile */}
        <div className="flex items-center gap-2 shrink-0">
          <Image src="/logo.svg" alt="Claude Workspace" width={28} height={28} className="sm:hidden" unoptimized />
          <Image src="/logo.svg" alt="Claude Workspace" width={32} height={32} className="hidden sm:block" unoptimized />
          <span className="hidden sm:inline font-mono text-base font-bold tracking-tight">
            CLAUDE<span style={{ color: '#d87756' }}>.</span>WS
          </span>
        </div>

        {/* Desktop: Full search input */}
        <div className="hidden sm:block flex-1 min-w-0 max-w-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search tasks..."
              className="pl-8 h-9 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right button group */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mobile: Search button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchOpen(!searchOpen)}
                  className="sm:hidden shrink-0"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search (⌘K)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Project selector - icon button on mobile, full dropdown on desktop */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile: Project dropdown icon */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="sm:hidden">
                  <FolderTree className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <ProjectSelectorContent onAddProject={onAddProject} />
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop: Full project selector */}
            <div className="hidden sm:flex items-center gap-2">
              <ProjectSelector onAddProject={onAddProject} />
              <span className="text-xs text-muted-foreground">
                ({tasks.length} tasks)
              </span>
            </div>
          </div>

          {/* Theme toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="shrink-0"
                  disabled={!mounted}
                >
                  {mounted && resolvedTheme === 'dark' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle theme</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Right sidebar toggle - opens panel with New Task and Settings */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={rightSidebarOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={toggleRightSidebar}
                  className="shrink-0 relative"
                >
                  <PanelRight className="h-4 w-4" />
                  {runningShellCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-medium bg-green-500 text-white rounded-full">
                      {runningShellCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Toggle actions
                  {runningShellCount > 0 && ` (${runningShellCount} shell${runningShellCount !== 1 ? 's' : ''} running)`}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Mobile expandable search */}
      {searchOpen && (
        <div className="sm:hidden px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search tasks..."
              className="pl-8 h-9 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
