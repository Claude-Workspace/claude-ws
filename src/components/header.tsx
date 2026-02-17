'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Search, PanelLeft, PanelRight, FolderTree, MessageCircleQuestion, Network, Terminal, X } from 'lucide-react';
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
import { useTerminalStore } from '@/stores/terminal-store';
import { useProjectStore } from '@/stores/project-store';
import { useSettingsUIStore } from '@/stores/settings-ui-store';
import { ProjectSelector, ProjectSelectorContent } from '@/components/header/project-selector';
import { useQuestionsStore } from '@/stores/questions-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useTranslations } from 'next-intl';

interface HeaderProps {
  onCreateTask: () => void;
  onAddProject: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function Header({ onCreateTask, onAddProject, searchQuery: externalSearchQuery = '', onSearchChange }: HeaderProps) {
  const t = useTranslations('common');
  const { tasks } = useTaskStore();
  const { isOpen: sidebarOpen, toggleSidebar } = useSidebarStore();
  const { isOpen: rightSidebarOpen, toggleRightSidebar } = useRightSidebarStore();
  const { shells } = useShellStore();
  const { setOpen: setSettingsOpen } = useSettingsUIStore();
  const { isOpen: terminalOpen, togglePanel: toggleTerminal } = useTerminalStore();
  const { activeProjectId, selectedProjectIds } = useProjectStore();
  const { pendingQuestions, fetchQuestions, isOpen: questionsPanelOpen, togglePanel: toggleQuestionsPanel } = useQuestionsStore();
  const questionCount = pendingQuestions.size;
  const { isOpen: workflowPanelOpen, togglePanel: toggleWorkflowPanel, getActiveAgentCount } = useWorkflowStore();
  const activeAgentCount = getActiveAgentCount();
  const [searchOpen, setSearchOpen] = useState(false);

  // Fetch pending questions on mount
  useEffect(() => {
    fetchQuestions(selectedProjectIds);
  }, [selectedProjectIds.join(',')]);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchChange || setInternalSearchQuery;

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
              <p>{t('toggleSidebar')} (⌘B)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Logo - show text on both mobile and desktop */}
        <div className="flex items-center gap-2 shrink-0">
          <Image src="/logo.svg" alt="Claude Workspace" width={28} height={28} className="sm:hidden" unoptimized />
          <Image src="/logo.svg" alt="Claude Workspace" width={32} height={32} className="hidden sm:block" unoptimized />
          <span className="font-mono text-base font-bold tracking-tight">
            CLAUDE<span style={{ color: '#d87756' }}>.</span>WS
          </span>
        </div>

        {/* Desktop: Full search input */}
        <div className="hidden sm:block flex-1 min-w-0 max-w-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('searchTasks')}
              className="pl-8 h-9 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 h-5 w-5 flex items-center justify-center rounded-sm hover:bg-muted-foreground/20 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            )}
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
                <p>{t('search')} (⌘K)</p>
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

          {/* Questions panel toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={questionsPanelOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => {
                    fetchQuestions(selectedProjectIds);
                    toggleQuestionsPanel();
                  }}
                  className="shrink-0 relative"
                >
                  <MessageCircleQuestion className="h-4 w-4" />
                  {questionCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-medium bg-amber-500 text-white rounded-full">
                      {questionCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Pending questions{questionCount > 0 ? ` (${questionCount})` : ''}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Workflow panel toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={workflowPanelOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={toggleWorkflowPanel}
                  className="shrink-0 relative"
                >
                  <Network className="h-4 w-4" />
                  {activeAgentCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-medium bg-blue-500 text-white rounded-full">
                      {activeAgentCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Agent workflow{activeAgentCount > 0 ? ` (${activeAgentCount})` : ''}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Terminal toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={terminalOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={toggleTerminal}
                  className="shrink-0"
                >
                  <Terminal className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Terminal (⌘`)</p>
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
                  {t('toggleActions')}
                  {runningShellCount > 0 && ` (${runningShellCount} ${t('shell')}${runningShellCount !== 1 ? 's' : ''} ${t('running')})`}
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
              placeholder={t('searchTasks')}
              className="pl-8 pr-8 h-9 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 h-5 w-5 flex items-center justify-center rounded-sm hover:bg-muted-foreground/20 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
