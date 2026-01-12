import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SidebarTab = 'files' | 'git';

// Tab state for multi-tab file editing
export interface EditorTabState {
  id: string;           // unique identifier (file path)
  filePath: string;     // absolute path relative to project
  isDirty: boolean;     // has unsaved changes
}

interface SidebarState {
  isOpen: boolean;
  activeTab: SidebarTab;
  expandedFolders: Set<string>;
  selectedFile: string | null;
  // Multi-tab state (replaces previewFile)
  openTabs: EditorTabState[];
  activeTabId: string | null;
  sidebarWidth: number;
  // Editor position for search result navigation
  editorPosition: { lineNumber?: number; column?: number; matchLength?: number } | null;
  // Git diff state
  diffFile: string | null;
  diffStaged: boolean;
}

interface SidebarActions {
  toggleSidebar: () => void;
  setIsOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: SidebarTab) => void;
  toggleFolder: (path: string) => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
  setSelectedFile: (path: string | null) => void;
  // Multi-tab actions (replaces setPreviewFile/closePreview)
  openTab: (filePath: string) => void;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTabId: (tabId: string) => void;
  updateTabDirty: (tabId: string, isDirty: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setEditorPosition: (position: { lineNumber?: number; column?: number; matchLength?: number } | null) => void;
  // Git diff actions
  setDiffFile: (path: string | null, staged?: boolean) => void;
  closeDiff: () => void;
}

type SidebarStore = SidebarState & SidebarActions;

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      // Initial state
      isOpen: false,
      activeTab: 'files',
      expandedFolders: new Set<string>(),
      selectedFile: null,
      // Multi-tab state
      openTabs: [],
      activeTabId: null,
      sidebarWidth: 280,
      editorPosition: null,
      diffFile: null,
      diffStaged: false,

      // Actions
      toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),

      setIsOpen: (isOpen) => set({ isOpen }),

      setActiveTab: (activeTab) => set({ activeTab }),

      toggleFolder: (path) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          if (newExpanded.has(path)) {
            newExpanded.delete(path);
          } else {
            newExpanded.add(path);
          }
          return { expandedFolders: newExpanded };
        }),

      expandFolder: (path) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          newExpanded.add(path);
          return { expandedFolders: newExpanded };
        }),

      collapseFolder: (path) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          newExpanded.delete(path);
          return { expandedFolders: newExpanded };
        }),

      setSelectedFile: (selectedFile) => set({ selectedFile }),

      // Multi-tab actions
      openTab: (filePath) =>
        set((state) => {
          // Check if tab already exists - switch to it
          const existing = state.openTabs.find((t) => t.filePath === filePath);
          if (existing) {
            return { activeTabId: existing.id };
          }
          // Create new tab
          const newTab: EditorTabState = {
            id: filePath, // Use filePath as ID for simplicity
            filePath,
            isDirty: false,
          };
          return {
            openTabs: [...state.openTabs, newTab],
            activeTabId: newTab.id,
          };
        }),

      closeTab: (tabId) =>
        set((state) => {
          const newTabs = state.openTabs.filter((t) => t.id !== tabId);
          let newActiveId = state.activeTabId;
          // If closing active tab, select adjacent tab
          if (tabId === state.activeTabId) {
            const idx = state.openTabs.findIndex((t) => t.id === tabId);
            newActiveId = newTabs[idx]?.id ?? newTabs[idx - 1]?.id ?? null;
          }
          return { openTabs: newTabs, activeTabId: newActiveId };
        }),

      closeAllTabs: () => set({ openTabs: [], activeTabId: null }),

      setActiveTabId: (activeTabId) => set({ activeTabId }),

      updateTabDirty: (tabId, isDirty) =>
        set((state) => ({
          openTabs: state.openTabs.map((t) =>
            t.id === tabId ? { ...t, isDirty } : t
          ),
        })),

      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),

      setEditorPosition: (editorPosition) => set({ editorPosition }),

      setDiffFile: (diffFile, staged = false) => set({ diffFile, diffStaged: staged }),

      closeDiff: () => set({ diffFile: null }),
    }),
    {
      name: 'sidebar-store',
      partialize: (state) => ({
        isOpen: state.isOpen,
        activeTab: state.activeTab,
        sidebarWidth: state.sidebarWidth,
        // Persist open tabs (without dirty state - will reload content)
        openTabs: state.openTabs.map((t) => ({
          id: t.id,
          filePath: t.filePath,
          isDirty: false, // Reset dirty state on reload
        })),
        activeTabId: state.activeTabId,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SidebarState>),
        // Always start with empty expandedFolders
        expandedFolders: new Set<string>(),
      }),
    }
  )
);
