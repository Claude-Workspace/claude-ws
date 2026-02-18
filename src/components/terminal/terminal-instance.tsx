'use client';

import { useEffect, useRef } from 'react';
import { useTerminalStore } from '@/stores/terminal-store';
import { getSocket } from '@/lib/socket-service';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

interface TerminalInstanceProps {
  terminalId: string;
  isVisible: boolean;
  isMobile?: boolean;
}

const darkTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

const lightTheme = {
  background: '#ffffff',
  foreground: '#383a42',
  cursor: '#383a42',
  selectionBackground: '#add6ff',
  black: '#000000',
  red: '#e45649',
  green: '#50a14f',
  yellow: '#c18401',
  blue: '#4078f2',
  magenta: '#a626a4',
  cyan: '#0184bc',
  white: '#a0a1a7',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#d19a66',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff',
};

export function TerminalInstance({ terminalId, isVisible, isMobile }: TerminalInstanceProps) {
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
          // Fallback: textarea + execCommand (works without user-gesture in more contexts)
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
        if (ok) toast.success('Copied to clipboard');
        else toast.error('Failed to copy');
      };

      const pasteFromClipboard = async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) terminal.paste(text);
        } catch {
          toast.error('Clipboard access denied');
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

        // Ctrl+C / Cmd+C: if text selected → copy, else let through for SIGINT
        if (ctrl && !e.shiftKey && e.key === 'c') {
          if (terminal.hasSelection()) {
            copySelectionToClipboard();
            terminal.clearSelection();
            return false;
          }
          // No selection — let xterm send ^C (SIGINT)
          return true;
        }

        // Ctrl+Shift+C: explicit copy
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
          copySelectionToClipboard();
          terminal.clearSelection();
          return false;
        }

        // Ctrl+Shift+V: paste
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
        clearTerminal: clearTerminalScreen,
      });

      // On mobile: touch scroll (WheelEvent dispatch) + selection mode
      // (tap → blinking cursor, hold+drag → select, vertical swipe → scroll).
      let mobileCleanup: (() => void) | undefined;
      if (isMobile) {
        // Prevent touch scroll from bleeding through the fixed overlay
        // to the page behind it. Our scroll is handled via WheelEvent dispatch.
        const preventTouchScroll = (e: TouchEvent) => { e.preventDefault(); };
        container.addEventListener('touchmove', preventTouchScroll, { passive: false });

        const screen = container.querySelector('.xterm-screen') as HTMLElement | null;
        if (screen) {
          let startY = 0;
          let startX = 0;
          let isVertical: boolean | null = null;
          // Momentum
          let velocityY = 0;
          let lastMoveTime = 0;
          let momentumRaf = 0;
          // Selection: two-tap anchor system
          // Tap 1 → set anchor (start point), Drag → select from anchor to finger
          let anchor: { col: number; bufferRow: number } | null = null;
          let isDragging = false;
          // Blinking cursor indicator
          let cursorEl: HTMLElement | null = null;
          let cursorBlink: ReturnType<typeof setInterval> | null = null;
          let cursorTimeout: ReturnType<typeof setTimeout> | null = null;

          // --- Helpers: cell coordinate conversion ---
          const getCellSize = () => ({
            w: screen.clientWidth / (terminal.cols || 1),
            h: screen.clientHeight / (terminal.rows || 1),
          });

          const screenToCell = (clientX: number, clientY: number) => {
            const rect = screen.getBoundingClientRect();
            const cell = getCellSize();
            return {
              col: Math.max(0, Math.min(terminal.cols - 1, Math.floor((clientX - rect.left) / cell.w))),
              row: Math.max(0, Math.min(terminal.rows - 1, Math.floor((clientY - rect.top) / cell.h))),
            };
          };

          const cellToScreen = (col: number, viewportRow: number) => {
            const rect = screen.getBoundingClientRect();
            const cell = getCellSize();
            return {
              x: rect.left + col * cell.w,
              y: rect.top + viewportRow * cell.h + cell.h / 2,
            };
          };

          // --- Helpers: momentum scroll ---
          const stopMomentum = () => {
            if (momentumRaf) { cancelAnimationFrame(momentumRaf); momentumRaf = 0; }
          };

          const emitWheel = (dy: number) => {
            screen.dispatchEvent(new WheelEvent('wheel', {
              deltaY: dy, deltaMode: WheelEvent.DOM_DELTA_PIXEL,
              bubbles: true, cancelable: true,
            }));
          };

          const startMomentum = () => {
            if (Math.abs(velocityY) < 0.3) return;
            let v = -velocityY * 16;
            const friction = 0.95;
            const tick = () => {
              if (Math.abs(v) < 0.5) { momentumRaf = 0; return; }
              emitWheel(v);
              v *= friction;
              momentumRaf = requestAnimationFrame(tick);
            };
            momentumRaf = requestAnimationFrame(tick);
          };

          // --- Helpers: cursor indicator (snaps to character grid) ---
          const removeCursor = () => {
            if (cursorTimeout) { clearTimeout(cursorTimeout); cursorTimeout = null; }
            if (cursorBlink) { clearInterval(cursorBlink); cursorBlink = null; }
            if (cursorEl) { cursorEl.remove(); cursorEl = null; }
          };

          const showCursorAtCell = (col: number, viewportRow: number) => {
            removeCursor();
            const cell = getCellSize();
            const el = document.createElement('div');
            const color = isDark ? darkTheme.cursor : lightTheme.cursor;
            el.style.cssText = `position:absolute;width:2px;height:${Math.round(cell.h)}px;background:${color};pointer-events:none;z-index:10;border-radius:1px;`;
            el.style.left = `${Math.round(col * cell.w)}px`;
            el.style.top = `${Math.round(viewportRow * cell.h)}px`;
            screen.appendChild(el);
            cursorEl = el;
            let vis = true;
            cursorBlink = setInterval(() => { vis = !vis; el.style.opacity = vis ? '1' : '0'; }, 530);
            cursorTimeout = setTimeout(removeCursor, 5000);
          };

          // --- Programmatic selection (no synthetic events needed) ---
          const updateSelection = (clientX: number, clientY: number) => {
            if (!anchor) return;
            const { col: endCol, row: endViewportRow } = screenToCell(clientX, clientY);
            const endBufRow = endViewportRow + terminal.buffer.active.viewportY;
            const { col: startCol, bufferRow: startBufRow } = anchor;

            // Determine direction and use terminal.select(col, row, length)
            const forward = endBufRow > startBufRow || (endBufRow === startBufRow && endCol >= startCol);
            if (forward) {
              const len = (endBufRow - startBufRow) * terminal.cols + (endCol - startCol) + 1;
              terminal.select(startCol, startBufRow, len);
            } else {
              const len = (startBufRow - endBufRow) * terminal.cols + (startCol - endCol) + 1;
              terminal.select(endCol, endBufRow, len);
            }
          };

          // --- Scroll helper (shared by both modes) ---
          const applyScroll = (dy: number, t: Touch) => {
            const now = Date.now();
            const dt = Math.max(now - lastMoveTime, 1);
            velocityY = 0.6 * velocityY + 0.4 * (dy / dt);
            emitWheel(-dy);
            startY = t.clientY;
            startX = t.clientX;
            lastMoveTime = now;
          };

          // --- Touch handlers ---
          const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            stopMomentum();
            const touch = e.touches[0];
            startY = touch.clientY;
            startX = touch.clientX;
            isVertical = null;
            isDragging = false;
            velocityY = 0;
            lastMoveTime = Date.now();

            if (selectionModeRef.current && anchor) {
              removeCursor();
            }
          };

          const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            const dy = t.clientY - startY;
            const dx = t.clientX - startX;

            if (selectionModeRef.current) {
              if (isDragging) {
                updateSelection(t.clientX, t.clientY);
                return;
              }

              if (isVertical === null && (Math.abs(dy) > 6 || Math.abs(dx) > 6)) {
                if (anchor) {
                  // Anchor set → any drag is selection
                  isVertical = false;
                  isDragging = true;
                  updateSelection(t.clientX, t.clientY);
                  return;
                }
                // No anchor → scroll
                isVertical = true;
              }

              if (isVertical) applyScroll(dy, t);
              return;
            }

            // Normal mode: direction detection + scroll
            if (isVertical === null && (Math.abs(dy) > 4 || Math.abs(dx) > 4)) {
              isVertical = Math.abs(dy) >= Math.abs(dx);
            }
            if (isVertical) applyScroll(dy, t);
          };

          const onTouchEnd = (e: TouchEvent) => {
            if (isVertical) startMomentum();

            if (selectionModeRef.current) {
              const t = e.changedTouches[0];
              if (!t) return;

              if (isDragging) {
                isDragging = false;
                return;
              }

              if (!isVertical) {
                // Tap → set/reposition anchor at cell grid
                const { col, row } = screenToCell(t.clientX, t.clientY);
                anchor = { col, bufferRow: row + terminal.buffer.active.viewportY };
                showCursorAtCell(col, row);
              }
            }
          };

          screen.addEventListener('touchstart', onTouchStart, { passive: true });
          screen.addEventListener('touchmove', onTouchMove, { passive: true });
          screen.addEventListener('touchend', onTouchEnd, { passive: true });

          mobileCleanup = () => {
            container.removeEventListener('touchmove', preventTouchScroll);
            stopMomentum(); removeCursor(); anchor = null;
          };
        } else {
          mobileCleanup = () => {
            container.removeEventListener('touchmove', preventTouchScroll);
          };
        }
      }

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Wire output FIRST so we don't miss anything
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

      // Ensure we're subscribed to this terminal's room
      socket?.emit('terminal:subscribe', { terminalId });

      // Wire input: terminal -> socket -> backend PTY
      const inputDisposable = terminal.onData((data: string) => {
        sendInput(terminalId, data);
      });

      // ResizeObserver to auto-fit when container size changes
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          sendResize(terminalId, terminal.cols, terminal.rows);
        } catch { /* ignore */ }
      });
      resizeObserver.observe(container);

      // Fit after a short delay to let layout settle, then send resize
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

  // Selection mode (mobile): sync store → ref, blur to hide keyboard
  const selectionMode = useTerminalStore((s) => s.selectionMode[terminalId]);
  useEffect(() => {
    selectionModeRef.current = !!selectionMode;
    if (selectionMode && terminalRef.current) {
      terminalRef.current.blur();
    } else if (!selectionMode && isVisible && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [selectionMode, isVisible]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ display: isVisible ? 'block' : 'none' }}
    />
  );
}
