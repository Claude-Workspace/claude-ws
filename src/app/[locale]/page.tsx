'use client';

import { useCallback, useEffect, useState } from 'react';
import { SearchProvider } from '@/components/search/search-provider';
import { Header } from '@/components/header';
import { Board } from '@/components/kanban/board';
import { CreateTaskDialog } from '@/components/kanban/create-task-dialog';
import { TaskDetailPanel } from '@/components/task/task-detail-panel';
import { FloatingChatWindowsContainer } from '@/components/task/floating-chat-windows-container';
import { SettingsPage } from '@/components/settings/settings-page';
import { SetupDialog } from '@/components/settings/setup-dialog';
import { SidebarPanel, FileTabsPanel, DiffTabsPanel } from '@/components/sidebar';
import { RightSidebar } from '@/components/right-sidebar';
import { QuestionsPanel } from '@/components/questions/questions-panel';
import { PluginList } from '@/components/agent-factory/plugin-list';
import { AccessAnywhereWizard } from '@/components/access-anywhere';
import { useProjectStore } from '@/stores/project-store';
import { useTaskStore } from '@/stores/task-store';
import { useFloatingWindowsStore } from '@/stores/floating-windows-store';
import { useTunnelStore } from '@/stores/tunnel-store';
import { Task } from '@/types';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useAgentFactoryUIStore } from '@/stores/agent-factory-ui-store';
import { useSettingsUIStore } from '@/stores/settings-ui-store';
import { useIsMobileViewport } from '@/hooks/use-mobile-viewport';

function KanbanApp() {
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { open: agentFactoryOpen, setOpen: setAgentFactoryOpen } = useAgentFactoryUIStore();
  const { open: settingsOpen, setOpen: setSettingsOpen } = useSettingsUIStore();
  const isMobile = useIsMobileViewport();

  const { projects, selectedProjectIds, fetchProjects, loading: projectLoading, error: projectError } = useProjectStore();
  const { selectedTask, fetchTasks, setSelectedTask, setSelectedTaskId, setPendingAutoStartTask } = useTaskStore();
  const toggleSidebar = useSidebarStore((s) => s.toggleSidebar);
  const isOpen = useSidebarStore((s) => s.isOpen);
  const setIsOpen = useSidebarStore((s) => s.setIsOpen);
  const openTabs = useSidebarStore((s) => s.openTabs);
  const activeTabId = useSidebarStore((s) => s.activeTabId);
  const closeTab = useSidebarStore((s) => s.closeTab);
  const hasOpenTabs = openTabs.length > 0;
  const diffTabs = useSidebarStore((s) => s.diffTabs);
  const activeDiffTabId = useSidebarStore((s) => s.activeDiffTabId);
  const closeDiffTab = useSidebarStore((s) => s.closeDiffTab);

  // Auto-show setup when no projects (skip if fetch failed e.g. due to 401 auth)
  const autoShowSetup = !projectLoading && !projectError && projects.length === 0;

  // Rehydrate from localStorage and fetch projects on mount
  useEffect(() => {
    useProjectStore.persist.rehydrate();
    useProjectStore.getState().fetchProjects();

    // Initialize tunnel store
    const { initSocketListeners, fetchStatus } = useTunnelStore.getState();
    initSocketListeners();
    fetchStatus();
  }, []);

  // Read project from URL and select it
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');

    if (projectId && projects.length > 0) {
      // Check if project exists
      const projectExists = projects.some(p => p.id === projectId);
      if (projectExists) {
        // Only set if not already selected to avoid loops
        const currentIds = useProjectStore.getState().selectedProjectIds;
        if (currentIds.length !== 1 || currentIds[0] !== projectId) {
          useProjectStore.getState().setSelectedProjectIds([projectId]);
        }
      }
    }
  }, [projects]);

  // Update URL when project selection changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    if (selectedProjectIds.length === 1) {
      url.searchParams.set('project', selectedProjectIds[0]);
    } else {
      url.searchParams.delete('project');
    }

    // Update URL without triggering a navigation
    window.history.replaceState({}, '', url.toString());
  }, [selectedProjectIds]);

  // Fetch tasks when selectedProjectIds changes
  useEffect(() => {
    if (!projectLoading) {
      useTaskStore.getState().fetchTasks(selectedProjectIds);
    }
  }, [selectedProjectIds, projectLoading]);

  // Mobile: redirect panel selection to floating window
  useEffect(() => {
    if (isMobile && selectedTask) {
      const { openWindow } = useFloatingWindowsStore.getState();
      openWindow(selectedTask.id, 'chat', selectedTask.projectId);
      setSelectedTask(null);
    }
  }, [isMobile, selectedTask, setSelectedTask]);

  // Handle task created event - select task if startNow is true
  const handleTaskCreated = (task: Task, startNow: boolean, processedPrompt?: string, fileIds?: string[]) => {
    if (startNow) {
      const { preferFloating, openWindow } = useFloatingWindowsStore.getState();
      if (preferFloating) {
        // Open as floating window
        openWindow(task.id, 'chat', task.projectId);
        setSelectedTaskId(task.id);
      } else {
        // Open in panel
        setSelectedTask(task);
      }
      setPendingAutoStartTask(task.id, processedPrompt, fileIds);
    }
  };

  // Handle close tab with unsaved changes warning
  const handleCloseTab = useCallback((tabId: string) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      const fileName = tab.filePath.split('/').pop() || tab.filePath;
      if (!confirm(`"${fileName}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }
    closeTab(tabId);
  }, [openTabs, closeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: New task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setCreateTaskOpen(true);
      }
      // Cmd/Ctrl + Space: New task
      if ((e.metaKey || e.ctrlKey) && e.code === 'Space') {
        e.preventDefault();
        setCreateTaskOpen(true);
      }
      // Note: Cmd+K and Cmd+P are handled by SearchProvider for Quick Open
      // Cmd/Ctrl + B: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      // Escape: Close tabs/panels in priority order
      // Priority: file tab > diff tab > task detail > sidebar
      // Note: Cmd+W cannot be overridden in browsers, so we use Escape instead
      if (e.key === 'Escape') {
        // 1. Close active file tab if any
        if (activeTabId && openTabs.length > 0) {
          handleCloseTab(activeTabId);
          return;
        }

        // 2. Close active diff tab if any
        if (activeDiffTabId && diffTabs.length > 0) {
          closeDiffTab(activeDiffTabId);
          return;
        }

        // 3. Close task detail panel if open
        if (selectedTask) {
          setSelectedTask(null);
          return;
        }

        // 4. Close sidebar if open
        if (isOpen) {
          setIsOpen(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTask, toggleSidebar, activeTabId, openTabs, handleCloseTab, activeDiffTabId, diffTabs, closeDiffTab, isOpen, setIsOpen, setSelectedTask]);

  if (projectLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <img src="/logo.svg" alt="Logo" className="h-8 w-8 animate-spin" />
          <span>Loading to Claude<span style={{ color: '#d87756' }}>.</span>WS</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Header
        onCreateTask={() => setCreateTaskOpen(true)}
        onAddProject={() => setSetupOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <SidebarPanel />

        {/* File tabs panel - in flow */}
        <FileTabsPanel />

        {/* Diff tabs panel - in flow */}
        <DiffTabsPanel />

        {/* Main content - Kanban board (fills remaining space) */}
        <main className="flex-1 overflow-auto min-w-0">
          {projects.length > 0 ? (
            <Board onCreateTask={() => setCreateTaskOpen(true)} searchQuery={searchQuery} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">No projects configured</p>
                <button
                  onClick={() => setSetupOpen(true)}
                  className="text-primary underline hover:no-underline"
                >
                  Set up a project
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Task detail panel - right sidebar (desktop only) */}
        {selectedTask && !isMobile && <TaskDetailPanel />}
      </div>

      {/* Dialogs */}
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        onTaskCreated={handleTaskCreated}
      />
      <SetupDialog open={setupOpen || autoShowSetup} onOpenChange={setSetupOpen} />

      {/* Agent Factory Dialog */}
      {agentFactoryOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <PluginList />
        </div>
      )}

      {/* Settings Page */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <SettingsPage />
        </div>
      )}

      {/* Right Sidebar - actions panel */}
      <RightSidebar
        projectId={selectedProjectIds[0]}
        onCreateTask={() => setCreateTaskOpen(true)}
      />

      {/* Questions Panel - pending questions sidebar */}
      <QuestionsPanel />

      {/* Access Anywhere Wizard */}
      <AccessAnywhereWizard />

      {/* Floating Chat Windows - rendered independently */}
      <FloatingChatWindowsContainer />
    </div>
  );
}

export default function Home() {
  return (
    <SearchProvider>
      <KanbanApp />
    </SearchProvider>
  );
}
