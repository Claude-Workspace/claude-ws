'use client';

import { useEffect, useState } from 'react';
import { SocketProvider } from '@/components/providers/socket-provider';
import { SearchProvider } from '@/components/search/search-provider';
import { Header } from '@/components/header';
import { Board } from '@/components/kanban/board';
import { CreateTaskDialog } from '@/components/kanban/create-task-dialog';
import { TaskDetailPanel } from '@/components/task/task-detail-panel';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { SetupDialog } from '@/components/settings/setup-dialog';
import { SidebarPanel, FilePreviewPanel, DiffPreviewPanel } from '@/components/sidebar';
import { useProjectStore } from '@/stores/project-store';
import { useTaskStore } from '@/stores/task-store';
import { useSidebarStore } from '@/stores/sidebar-store';

function KanbanApp() {
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const { projects, selectedProjectIds, fetchProjects, loading: projectLoading } = useProjectStore();
  const { selectedTask, fetchTasks } = useTaskStore();
  const { toggleSidebar, previewFile, diffFile } = useSidebarStore();

  // Auto-show setup when no projects
  const autoShowSetup = !projectLoading && projects.length === 0;

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch tasks when selectedProjectIds changes
  useEffect(() => {
    if (!projectLoading) {
      fetchTasks(selectedProjectIds);
    }
  }, [selectedProjectIds, projectLoading, fetchTasks]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: New task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setCreateTaskOpen(true);
      }
      // Note: Cmd+K and Cmd+P are handled by SearchProvider for Quick Open
      // Cmd/Ctrl + B: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      // Escape: Close panels
      if (e.key === 'Escape') {
        if (selectedTask) {
          useTaskStore.getState().setSelectedTask(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTask, toggleSidebar]);

  if (projectLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Header
        onCreateTask={() => setCreateTaskOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddProject={() => setSetupOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <SidebarPanel />

        {/* File preview panel - in flow, pushes content */}
        <FilePreviewPanel />

        {/* Diff preview panel - in flow, pushes content */}
        <DiffPreviewPanel />

        {/* Main content - Kanban board (hidden when preview is open) */}
        {!previewFile && !diffFile && (
          <main className="flex-1 overflow-auto min-w-0">
            {projects.length > 0 ? (
              <Board />
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
        )}

        {/* Task detail panel - right sidebar */}
        {selectedTask && <TaskDetailPanel />}
      </div>

      {/* Dialogs */}
      <CreateTaskDialog open={createTaskOpen} onOpenChange={setCreateTaskOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <SetupDialog open={setupOpen || autoShowSetup} onOpenChange={setSetupOpen} />
    </div>
  );
}

export default function Home() {
  return (
    <SocketProvider>
      <SearchProvider>
        <KanbanApp />
      </SearchProvider>
    </SocketProvider>
  );
}
