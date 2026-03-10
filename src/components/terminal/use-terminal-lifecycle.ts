'use client';

import { useEffect, useRef } from 'react';
import { useTerminalStore } from '@/stores/terminal-store';
import { getSocket } from '@/lib/socket-service';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { darkTheme, lightTheme } from '@/components/terminal/terminal-themes';
import { setupTerminalMobileTouchHandlers } from '@/components/terminal/setup-terminal-mobile-touch-handlers';

interface UseTerminalLifecycleOptions {
  terminalId: string;
  isVisible: boolean;
  isMobile?: boolean;
}

/**
 * Custom hook encapsulating terminal initialization, socket wiring,
 * mobile touch handling, theme updates, resize fitting, and cleanup.
 *
 * Returns a ref to attach to the container div.
 */
export function useTerminalLifecycle({ terminalId, isVisible, isMobile }: UseTerminalLifecycleOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const terminalRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fitAddonRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  const selectionModeRef = useRef(false);

  const { sendInput, sendResize, panelHeight } = useTerminalStore();
  const { resolvedTheme } = useTheme();
  const tShells = useTranslations('shells');
  const copiedMsgRef = useRef(tShells('copiedToClipboard'));
  const failedCopyMsgRef = useRef(tShells('failedToCopy'));
  const clipboardDeniedMsgRef = useRef(tShells('clipboardDenied'));
  copiedMsgRef.current = tShells('copiedToClipboard');
  failedCopyMsgRef.current = tShells('failedToCopy');
  clipboardDeniedMsgRef.current = tShells('clipboardDenied');

  // Initialize xterm on mount
  useEffect(() => {
    if (isInitializedRef.current || !containerRef.current) return;
    isInitializedRef.current = true;

    const container = containerRef.current;

    (async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');
      // @ts-expect-error -- CSS module import handled by Next.js bundler
      await import('@xterm/xterm/css/xterm.css');

      if (!container || !container.isConnected) return;

      const isDark = resolvedTheme !== 'light';

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: isMobile ? 12 : 13,
        fontFamily: '"Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
        theme: isDark ? darkTheme : lightTheme,
        allowProposedApi: true,
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(container);

      // --- Clipboard helpers (with fallback for mobile) ---
      const writeClipboard = async (text: string): Promise<boolean> => {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          try {
            document.execCommand('copy');
            return true;
          } catch {
            return false;
          } finally {
            ta.remove();
          }
        }
      };

      const copySelectionToClipboard = async () => {
        const sel = terminal.getSelection();
        if (!sel) return;
        const ok = await writeClipboard(sel);
        if (ok) toast.success(copiedMsgRef.current);
        else toast.error(failedCopyMsgRef.current);
      };

      const pasteFromClipboard = async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) terminal.paste(text);
        } catch {
          toast.error(clipboardDeniedMsgRef.current);
        }
      };

      const selectAllText = () => {
        terminal.selectAll();
      };

      const clearTerminalScreen = () => {
        terminal.clear();
      };

      // --- Keyboard handler ---
      terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.type !== 'keydown') return true;

        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const ctrl = isMac ? e.metaKey : e.ctrlKey;

        if (ctrl && !e.shiftKey && e.key === 'c') {
          if (terminal.hasSelection()) {
            copySelectionToClipboard();
            terminal.clearSelection();
            return false;
          }
          return true;
        }

        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
          copySelectionToClipboard();
          terminal.clearSelection();
          return false;
        }

        if (e.ctrlKey && e.shiftKey && e.key === 'V') {
          pasteFromClipboard();
          return false;
        }

        return true;
      });

      // --- Register actions for store dispatch ---
      const store = useTerminalStore.getState();
      store.registerTerminalActions(terminalId, {
        copySelection: copySelectionToClipboard,
        selectAll: selectAllText,
        pasteClipboard: pasteFromClipboard,
        pasteText: (text: string) => terminal.paste(text),
        clearTerminal: clearTerminalScreen,
      });

      // Mobile touch handling
      let mobileCleanup: (() => void) | undefined;
      if (isMobile) {
        mobileCleanup = setupTerminalMobileTouchHandlers(
          container, terminal, isDark, selectionModeRef, darkTheme, lightTheme,
        );
      }

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Wire socket output
      const socket = getSocket();
      const handleOutput = (msg: { terminalId: string; data: string }) => {
        if (msg.terminalId === terminalId) {
          terminal.write(msg.data);
        }
      };
      const handleExit = (msg: { terminalId: string }) => {
        if (msg.terminalId === terminalId) {
          terminal.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
        }
      };

      socket?.on('terminal:output', handleOutput);
      socket?.on('terminal:exit', handleExit);
      socket?.emit('terminal:subscribe', { terminalId });

      const inputDisposable = terminal.onData((data: string) => {
        sendInput(terminalId, data);
      });

      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          sendResize(terminalId, terminal.cols, terminal.rows);
        } catch { /* ignore */ }
      });
      resizeObserver.observe(container);

      setTimeout(() => {
        try {
          fitAddon.fit();
          sendResize(terminalId, terminal.cols, terminal.rows);
        } catch { /* ignore */ }
      }, 100);

      cleanupRef.current = () => {
        mobileCleanup?.();
        resizeObserver.disconnect();
        inputDisposable.dispose();
        socket?.off('terminal:output', handleOutput);
        socket?.off('terminal:exit', handleExit);
        useTerminalStore.getState().unregisterTerminalActions(terminalId);
        terminal.dispose();
        isInitializedRef.current = false;
        terminalRef.current = null;
        fitAddonRef.current = null;
      };
    })();

    return () => {
      cleanupRef.current?.();
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]);

  // Re-fit when panel height changes
  useEffect(() => {
    if (isVisible && fitAddonRef.current && terminalRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
          sendResize(terminalId, terminalRef.current.cols, terminalRef.current.rows);
        } catch { /* ignore */ }
      }, 50);
    }
  }, [isVisible, panelHeight, terminalId, sendResize]);

  // Focus terminal when it becomes visible
  useEffect(() => {
    if (isVisible && terminalRef.current) {
      setTimeout(() => terminalRef.current?.focus(), 50);
    }
  }, [isVisible]);

  // Update theme dynamically
  useEffect(() => {
    if (terminalRef.current) {
      const isDark = resolvedTheme !== 'light';
      terminalRef.current.options.theme = isDark ? darkTheme : lightTheme;
    }
  }, [resolvedTheme]);

  // Selection mode (mobile): sync store -> ref, blur to hide keyboard
  const selectionMode = useTerminalStore((s) => s.selectionMode[terminalId]);
  useEffect(() => {
    selectionModeRef.current = !!selectionMode;
    if (selectionMode && terminalRef.current) {
      terminalRef.current.blur();
    } else if (!selectionMode && isVisible && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [selectionMode, isVisible]);

  return containerRef;
}
