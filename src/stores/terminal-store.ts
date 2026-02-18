/**
 * Terminal Store - Interactive terminal state management
 *
 * Uses the shared socket-service singleton (same socket as shell-store, inline-edit, etc.)
 * Architecturally separate from shell-store (background shells).
 *
 * Tabs and session IDs are persisted so panel toggle / page refresh
 * can reconnect to still-alive backend PTY sessions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSocket } from '@/lib/socket-service';
import { createLogger } from '@/lib/logger';
import type { Socket } from 'socket.io-client';

const log = createLogger('TerminalStore');

export interface TerminalInstanceActions {
  copySelection: () => void;
  selectAll: () => void;
  pasteClipboard: () => void;
  pasteText: (text: string) => void;
  clearTerminal: () => void;
}

export interface TerminalTab {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  isConnected: boolean;
}

interface TerminalState {
  isOpen: boolean;
  panelHeight: number;
  activeTabId: string | null;
  tabs: TerminalTab[];
  _listenersAttached: boolean;
  _isCreating: boolean;
  selectionMode: Record<string, boolean>;
  _terminalActions: Record<string, TerminalInstanceActions>;
}

interface TerminalActions {
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setPanelHeight: (height: number) => void;
  createTerminal: (projectId?: string) => Promise<string | null>;
  closeTerminal: (terminalId: string) => void;
  setActiveTab: (terminalId: string) => void;
  sendInput: (terminalId: string, data: string) => void;
  sendResize: (terminalId: string, cols: number, rows: number) => void;
  renameTerminal: (terminalId: string, title: string) => void;
  closeAllTerminals: () => void;
  /** Re-subscribe to existing PTY sessions after reconnect / page refresh */
  reconnectTabs: () => Promise<void>;
  _attachListeners: () => void;
  setSelectionMode: (id: string, active: boolean) => void;
  registerTerminalActions: (id: string, actions: TerminalInstanceActions) => void;
  unregisterTerminalActions: (id: string) => void;
  copySelection: (id: string) => void;
  selectAll: (id: string) => void;
  pasteClipboard: (id: string) => void;
  /** Paste pre-read text via xterm.paste() — keeps IME state clean */
  pasteText: (id: string, text: string) => void;
  clearTerminal: (id: string) => void;
}

type TerminalStore = TerminalState & TerminalActions;

export const MIN_PANEL_HEIGHT = 150;
export const MAX_PANEL_HEIGHT = 600;
const DEFAULT_PANEL_HEIGHT = 300;

/** Find the lowest available tab number (1-based) not already used by current tabs */
function nextAvailableTabNumber(tabs: TerminalTab[]): number {
  const usedNumbers = new Set(
    tabs.map((t) => {
      const match = t.title.match(/^Terminal (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
  );
  let n = 1;
  while (usedNumbers.has(n)) n++;
  return n;
}

/** Wait for socket to be connected, resolves immediately if already connected */
function waitForConnection(socket: Socket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve) => {
    socket.once('connect', () => resolve());
  });
}

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      isOpen: false,
      panelHeight: DEFAULT_PANEL_HEIGHT,
      activeTabId: null,
      tabs: [],
      _listenersAttached: false,
      _isCreating: false,
      selectionMode: {},
      _terminalActions: {},

      togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),

      setPanelHeight: (height) => {
        set({ panelHeight: Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, height)) });
      },

      _attachListeners: () => {
        if (get()._listenersAttached) return;
        const socket = getSocket();
        socket.on('terminal:exit', (data: { terminalId: string }) => {
          set((s) => ({
            tabs: s.tabs.map((t) =>
              t.id === data.terminalId ? { ...t, isConnected: false } : t
            ),
          }));
        });
        set({ _listenersAttached: true });
      },

      reconnectTabs: async () => {
        const { tabs, _attachListeners } = get();
        if (tabs.length === 0) return;

        _attachListeners();
        const socket = getSocket();
        await waitForConnection(socket);

        // Check each persisted tab — if PTY still alive, re-subscribe; otherwise mark dead
        const updatedTabs: TerminalTab[] = [];
        for (const tab of tabs) {
          const alive = await new Promise<boolean>((resolve) => {
            socket.emit(
              'terminal:check',
              { terminalId: tab.id },
              (result: { alive: boolean }) => resolve(result?.alive ?? false)
            );
            // Timeout after 2s — treat as dead
            setTimeout(() => resolve(false), 2000);
          });

          if (alive) {
            socket.emit('terminal:subscribe', { terminalId: tab.id });
            updatedTabs.push({ ...tab, isConnected: true });
          } else {
            // PTY is gone — remove stale tab
            log.info({ terminalId: tab.id }, 'Stale terminal session removed');
          }
        }

        const { activeTabId } = get();
        const activeStillExists = updatedTabs.some((t) => t.id === activeTabId);
        set({
          tabs: updatedTabs,
          activeTabId: activeStillExists
            ? activeTabId
            : updatedTabs.length > 0
              ? updatedTabs[0].id
              : null,
        });
      },

      createTerminal: async (projectId) => {
        // Prevent concurrent creation (race condition on mobile rapid taps)
        if (get()._isCreating) {
          log.info('Terminal creation already in-flight, skipping');
          return null;
        }
        set({ _isCreating: true });

        get()._attachListeners();
        const socket = getSocket();
        await waitForConnection(socket);

        return new Promise((resolve) => {
          log.info({ projectId }, 'Creating terminal');

          // Timeout guard — if ack never arrives, reset _isCreating
          const timeout = setTimeout(() => {
            log.error('Terminal create timed out (no ack after 8s)');
            set({ _isCreating: false });
            resolve(null);
          }, 8000);

          socket.emit(
            'terminal:create',
            { projectId: projectId || undefined },
            (result: { success: boolean; terminalId?: string; error?: string }) => {
              clearTimeout(timeout);
              log.info({ result }, 'terminal:create ack received');
              set({ _isCreating: false });
              if (result.success && result.terminalId) {
                const tabNumber = nextAvailableTabNumber(get().tabs);
                const tab: TerminalTab = {
                  id: result.terminalId,
                  projectId: projectId || 'global',
                  title: `Terminal ${tabNumber}`,
                  createdAt: Date.now(),
                  isConnected: true,
                };
                set((s) => ({
                  tabs: [...s.tabs, tab],
                  activeTabId: result.terminalId!,
                  isOpen: true,
                }));
                resolve(result.terminalId);
              } else {
                log.error({ error: result.error }, 'Failed to create terminal');
                resolve(null);
              }
            }
          );
        });
      },

      closeTerminal: (terminalId) => {
        const socket = getSocket();
        socket.emit('terminal:close', { terminalId });
        const { tabs, activeTabId, selectionMode, _terminalActions } = get();
        const newTabs = tabs.filter((t) => t.id !== terminalId);
        const newActiveId =
          activeTabId === terminalId
            ? newTabs.length > 0
              ? newTabs[newTabs.length - 1].id
              : null
            : activeTabId;
        const newSelectionMode = { ...selectionMode };
        delete newSelectionMode[terminalId];
        const newActions = { ..._terminalActions };
        delete newActions[terminalId];
        set({ tabs: newTabs, activeTabId: newActiveId, selectionMode: newSelectionMode, _terminalActions: newActions });
      },

      setActiveTab: (terminalId) => set({ activeTabId: terminalId }),

      sendInput: (terminalId, data) => {
        getSocket().emit('terminal:input', { terminalId, data });
      },

      sendResize: (terminalId, cols, rows) => {
        getSocket().emit('terminal:resize', { terminalId, cols, rows });
      },

      renameTerminal: (terminalId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === terminalId ? { ...t, title: trimmed } : t
          ),
        }));
      },

      closeAllTerminals: () => {
        const socket = getSocket();
        const { tabs } = get();
        tabs.forEach((t) => socket.emit('terminal:close', { terminalId: t.id }));
        set({ tabs: [], activeTabId: null });
      },

      setSelectionMode: (id, active) => {
        set((s) => ({ selectionMode: { ...s.selectionMode, [id]: active } }));
      },

      registerTerminalActions: (id, actions) => {
        set((s) => ({ _terminalActions: { ...s._terminalActions, [id]: actions } }));
      },

      unregisterTerminalActions: (id) => {
        set((s) => {
          const next = { ...s._terminalActions };
          delete next[id];
          return { _terminalActions: next };
        });
      },

      copySelection: (id) => get()._terminalActions[id]?.copySelection(),
      selectAll: (id) => get()._terminalActions[id]?.selectAll(),
      pasteClipboard: (id) => get()._terminalActions[id]?.pasteClipboard(),
      pasteText: (id, text) => get()._terminalActions[id]?.pasteText(text),
      clearTerminal: (id) => get()._terminalActions[id]?.clearTerminal(),
    }),
    {
      name: 'terminal-store',
      partialize: (state) => ({
        isOpen: state.isOpen,
        panelHeight: state.panelHeight,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
);
