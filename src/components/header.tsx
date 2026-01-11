'use client';

import { useState } from 'react';
import { Settings, Plus, Search, PanelLeft, PanelRight, FolderTree } from 'lucide-react';
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
import { ProjectSelector, ProjectSelectorContent } from '@/components/header/project-selector';

interface HeaderProps {
  onCreateTask: () => void;
  onOpenSettings: () => void;
  onAddProject: () => void;
}

export function Header({ onCreateTask, onOpenSettings, onAddProject }: HeaderProps) {
  const { tasks } = useTaskStore();
  const { isOpen: sidebarOpen, toggleSidebar } = useSidebarStore();
  const { isOpen: rightSidebarOpen, toggleRightSidebar } = useRightSidebarStore();
  const [searchOpen, setSearchOpen] = useState(false);

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
          <Image src="/logo.png" alt="Claude Kanban" width={28} height={28} className="sm:hidden" />
          <Image src="/logo.png" alt="Claude Kanban" width={32} height={32} className="hidden sm:block" />
          <span className="hidden sm:inline font-mono text-base font-bold tracking-tight">
            CLAUDE-KANBAN
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

          {/* Right sidebar toggle - opens panel with New Task and Settings */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={rightSidebarOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={toggleRightSidebar}
                  className="shrink-0"
                >
                  <PanelRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle actions</p>
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
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
