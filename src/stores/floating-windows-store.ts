import { create } from 'zustand';

/**
 * Store to manage multiple floating windows with z-index layering.
 * Each window can be brought to front by clicking/interacting with it.
 */

interface FloatingWindow {
  id: string;  // Usually taskId for chat windows
  type: 'chat' | 'other';  // Window type for filtering
  projectId: string;  // Project this window belongs to
  zIndex: number;  // Current z-index for layering
}

interface FloatingWindowsState {
  windows: Map<string, FloatingWindow>;
  baseZIndex: number;  // Base z-index for floating windows (60 by default)
  nextZIndex: number;  // Counter for the next z-index to assign
  preferFloating: boolean;  // If true, new chats open as floating windows
}

interface FloatingWindowsActions {
  // Register a new floating window
  openWindow: (id: string, type: FloatingWindow['type'], projectId: string) => void;
  // Close a floating window
  closeWindow: (id: string) => void;
  // Bring a window to front (increase its z-index)
  bringToFront: (id: string) => void;
  // Close all windows belonging to a specific project
  closeWindowsByProject: (projectId: string) => void;
  // Get the current z-index for a window
  getWindowZIndex: (id: string) => number;
  // Check if a window is open
  isWindowOpen: (id: string) => boolean;
  // Get all open window IDs
  getOpenWindowIds: () => string[];
  // Get all windows for a project
  getWindowsByProject: (projectId: string) => FloatingWindow[];
  // Set floating preference (called when panel closes)
  setPreferFloating: (prefer: boolean) => void;
}

type FloatingWindowsStore = FloatingWindowsState & FloatingWindowsActions;

const BASE_Z_INDEX = 60;

// Load preference from localStorage
function loadPreferFloating(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('prefer-floating-chat') === 'true';
  } catch {
    return false;
  }
}

// Save preference to localStorage
function savePreferFloating(prefer: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('prefer-floating-chat', String(prefer));
  } catch {
    // Ignore storage errors
  }
}

export const useFloatingWindowsStore = create<FloatingWindowsStore>((set, get) => ({
  windows: new Map(),
  baseZIndex: BASE_Z_INDEX,
  nextZIndex: BASE_Z_INDEX + 1,
  preferFloating: loadPreferFloating(),

  openWindow: (id, type, projectId) => {
    const { windows, nextZIndex } = get();

    // If window already exists, bring it to front instead
    if (windows.has(id)) {
      get().bringToFront(id);
      return;
    }

    const newWindows = new Map(windows);
    newWindows.set(id, {
      id,
      type,
      projectId,
      zIndex: nextZIndex,
    });

    // Opening a floating window sets the preference
    savePreferFloating(true);

    set({
      windows: newWindows,
      nextZIndex: nextZIndex + 1,
      preferFloating: true,
    });
  },

  closeWindow: (id) => {
    const { windows } = get();
    if (!windows.has(id)) return;

    const newWindows = new Map(windows);
    newWindows.delete(id);
    set({ windows: newWindows });
  },

  bringToFront: (id) => {
    const { windows, nextZIndex } = get();
    const window = windows.get(id);
    if (!window) return;

    // Skip if already has the highest z-index
    const maxZIndex = Math.max(...Array.from(windows.values()).map(w => w.zIndex));
    if (window.zIndex === maxZIndex) return;

    const newWindows = new Map(windows);
    newWindows.set(id, {
      ...window,
      zIndex: nextZIndex,
    });

    set({
      windows: newWindows,
      nextZIndex: nextZIndex + 1,
    });
  },

  closeWindowsByProject: (projectId) => {
    const { windows } = get();
    const newWindows = new Map(windows);

    for (const [id, window] of windows) {
      if (window.projectId === projectId) {
        newWindows.delete(id);
      }
    }

    set({ windows: newWindows });
  },

  getWindowZIndex: (id) => {
    const window = get().windows.get(id);
    return window?.zIndex ?? get().baseZIndex;
  },

  isWindowOpen: (id) => {
    return get().windows.has(id);
  },

  getOpenWindowIds: () => {
    return Array.from(get().windows.keys());
  },

  getWindowsByProject: (projectId) => {
    return Array.from(get().windows.values()).filter(w => w.projectId === projectId);
  },

  setPreferFloating: (prefer) => {
    savePreferFloating(prefer);
    set({ preferFloating: prefer });
  },
}));
