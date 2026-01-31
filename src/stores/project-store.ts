import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@/types';
import { useTaskStore } from './task-store';
import { useInteractiveCommandStore } from './interactive-command-store';
import { useSidebarStore } from './sidebar-store';
import { useFloatingWindowsStore } from './floating-windows-store';

interface ProjectState {
  projects: Project[];
  selectedProjectIds: string[];    // empty = all projects mode
  activeProjectId: string | null;  // for sidebar context (single project)
  loading: boolean;
  error: string | null;
}

interface ProjectActions {
  // Selection actions
  toggleProjectSelection: (projectId: string) => void;
  setSelectedProjectIds: (ids: string[]) => void;
  selectAllProjects: () => void;
  setActiveProjectId: (id: string | null) => void;

  // Computed helpers
  isAllProjectsMode: () => boolean;
  getActiveProject: () => Project | null;
  getSelectedProjects: () => Project[];

  // CRUD actions
  fetchProjects: () => Promise<void>;
  createProject: (data: { name: string; path: string }) => Promise<Project>;
  updateProject: (id: string, data: Partial<Pick<Project, 'name' | 'path' | 'provider'>>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Deprecated - for backward compat
  /** @deprecated Use getActiveProject() instead */
  currentProject: Project | null;
  /** @deprecated Use setActiveProjectId() instead */
  setCurrentProject: (project: Project | null) => void;
}

type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      selectedProjectIds: [],  // empty = all projects
      activeProjectId: null,
      loading: true,
      error: null,

      // Deprecated - computed from activeProjectId
      get currentProject() {
        return get().getActiveProject();
      },

      // Selection actions
      toggleProjectSelection: (projectId) => {
        const { selectedProjectIds, activeProjectId } = get();
        let newSelectedIds: string[];

        if (selectedProjectIds.length === 0) {
          // Currently "all projects" - switch to single select
          newSelectedIds = [projectId];
          set({
            selectedProjectIds: newSelectedIds,
            activeProjectId: projectId
          });
        } else if (selectedProjectIds.includes(projectId)) {
          // Deselect this project
          newSelectedIds = selectedProjectIds.filter(id => id !== projectId);
          // Update activeProjectId if needed
          const newActiveId = newSelectedIds.length === 1
            ? newSelectedIds[0]
            : (newSelectedIds.includes(activeProjectId || '') ? activeProjectId : null);
          set({
            selectedProjectIds: newSelectedIds,
            activeProjectId: newActiveId
          });
        } else {
          // Add to selection
          newSelectedIds = [...selectedProjectIds, projectId];
          // Auto-set activeProjectId if only 1 selected
          const newActiveId = newSelectedIds.length === 1 ? newSelectedIds[0] : activeProjectId;
          set({
            selectedProjectIds: newSelectedIds,
            activeProjectId: newActiveId
          });
        }

        // Close floating windows for tasks NOT in selected projects
        useFloatingWindowsStore.getState().closeWindowsNotInProjects(newSelectedIds);

        // Close inline chat panel only if the selected task is NOT in the new project selection
        const taskStore = useTaskStore.getState();
        const selectedTask = taskStore.selectedTask;
        if (selectedTask && newSelectedIds.length > 0 && !newSelectedIds.includes(selectedTask.projectId)) {
          taskStore.selectTask(null);
        }

        // Close interactive commands
        useInteractiveCommandStore.getState().closeCommand();

        // Close file explorer and all open editor tabs
        const sidebarStore = useSidebarStore.getState();
        sidebarStore.setIsOpen(false);
        sidebarStore.closeAllTabs();
        sidebarStore.closeAllDiffTabs();
      },

      setSelectedProjectIds: (ids) => {
        const activeId = ids.length === 1 ? ids[0] : null;
        set({ selectedProjectIds: ids, activeProjectId: activeId });

        // Close floating windows for tasks NOT in selected projects
        useFloatingWindowsStore.getState().closeWindowsNotInProjects(ids);

        // Close inline chat panel only if the selected task is NOT in the new project selection
        const taskStore = useTaskStore.getState();
        const selectedTask = taskStore.selectedTask;
        if (selectedTask && ids.length > 0 && !ids.includes(selectedTask.projectId)) {
          taskStore.selectTask(null);
        }

        // Close interactive commands
        useInteractiveCommandStore.getState().closeCommand();

        // Close file explorer and all open editor tabs
        const sidebarStore = useSidebarStore.getState();
        sidebarStore.setIsOpen(false);
        sidebarStore.closeAllTabs();
        sidebarStore.closeAllDiffTabs();
      },

      selectAllProjects: () => {
        set({ selectedProjectIds: [], activeProjectId: null });

        // In "all projects" mode, keep all floating windows open (no filtering needed)
        // closeWindowsNotInProjects with empty array will keep all windows

        // Close interactive commands
        useInteractiveCommandStore.getState().closeCommand();
      },

      setActiveProjectId: (id) => {
        set({ activeProjectId: id });
      },

      // Computed helpers
      isAllProjectsMode: () => {
        return get().selectedProjectIds.length === 0;
      },

      getActiveProject: () => {
        const { projects, activeProjectId, selectedProjectIds } = get();
        // Auto-derive when single project selected
        if (selectedProjectIds.length === 1) {
          return projects.find(p => p.id === selectedProjectIds[0]) || null;
        }
        if (!activeProjectId) return null;
        return projects.find(p => p.id === activeProjectId) || null;
      },

      getSelectedProjects: () => {
        const { projects, selectedProjectIds } = get();
        if (selectedProjectIds.length === 0) return projects;
        return projects.filter(p => selectedProjectIds.includes(p.id));
      },

      // Deprecated - for backward compat
      setCurrentProject: (project) => {
        if (project) {
          set({
            selectedProjectIds: [project.id],
            activeProjectId: project.id
          });
        } else {
          set({
            selectedProjectIds: [],
            activeProjectId: null
          });
        }
      },

      // CRUD actions
      fetchProjects: async () => {
        set({ loading: true, error: null });
        try {
          const res = await fetch('/api/projects');
          if (!res.ok) throw new Error('Failed to fetch projects');
          const projects = await res.json();
          set({ projects, loading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            loading: false,
          });
        }
      },

      createProject: async (data) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error('Failed to create project');
          const project = await res.json();
          set((state) => ({
            projects: [...state.projects, project],
            loading: false,
          }));
          return project;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            loading: false,
          });
          throw error;
        }
      },

      updateProject: async (id, data) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`/api/projects/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error('Failed to update project');
          const updated = await res.json();
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? updated : p)),
            loading: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            loading: false,
          });
          throw error;
        }
      },

      deleteProject: async (id) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`/api/projects/${id}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('Failed to delete project');
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            selectedProjectIds: state.selectedProjectIds.filter(pid => pid !== id),
            activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
            loading: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            loading: false,
          });
          throw error;
        }
      },
    }),
    {
      name: 'project-store',
      partialize: (state) => ({
        selectedProjectIds: state.selectedProjectIds,
        activeProjectId: state.activeProjectId,
      }),
      skipHydration: true,  // Manual hydration for Next.js SSR
    }
  )
);
