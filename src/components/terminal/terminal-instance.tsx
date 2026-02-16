'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { SendHorizonal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTerminalStore } from '@/stores/terminal-store';
import { getSocket } from '@/lib/socket-service';
import { useTheme } from 'next-themes';

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

  const { sendInput, sendResize, panelHeight } = useTerminalStore();
  const { resolvedTheme } = useTheme();

  // Mobile input bar state
  const [mobileInput, setMobileInput] = useState('');
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const handleMobileSend = useCallback(() => {
    if (mobileInput) {
      sendInput(terminalId, mobileInput + '\r');
      setMobileInput('');
    } else {
      // Empty send = just Enter
      sendInput(terminalId, '\r');
    }
    // Keep focus on input
    mobileInputRef.current?.focus();
  }, [mobileInput, terminalId, sendInput]);

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
        // On mobile, disable xterm's built-in keyboard handling — we use the input bar
        disableStdin: !!isMobile,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(container);

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

      // Wire input: terminal -> socket -> backend PTY (desktop only)
      // On mobile, input goes through the input bar instead
      let inputDisposable: { dispose: () => void } | null = null;
      if (!isMobile) {
        inputDisposable = terminal.onData((data: string) => {
          sendInput(terminalId, data);
        });
      }

      // ResizeObserver to auto-fit when container size changes
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          sendResize(terminalId, terminal.cols, terminal.rows);
        } catch { /* ignore */ }
      });
      resizeObserver.observe(container);

      // Fit after a short delay to let layout settle, then send resize
      // to trigger shell prompt redraw (handles reconnect to existing PTY)
      setTimeout(() => {
        try {
          fitAddon.fit();
          sendResize(terminalId, terminal.cols, terminal.rows);
        } catch { /* ignore */ }
      }, 100);

      cleanupRef.current = () => {
        resizeObserver.disconnect();
        inputDisposable?.dispose();
        socket?.off('terminal:output', handleOutput);
        socket?.off('terminal:exit', handleExit);
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

  // Focus terminal when it becomes visible (desktop only)
  useEffect(() => {
    if (isVisible && !isMobile && terminalRef.current) {
      setTimeout(() => terminalRef.current?.focus(), 50);
    }
  }, [isVisible, isMobile]);

  // Update theme dynamically
  useEffect(() => {
    if (terminalRef.current) {
      const isDark = resolvedTheme !== 'light';
      terminalRef.current.options.theme = isDark ? darkTheme : lightTheme;
    }
  }, [resolvedTheme]);

  if (isMobile) {
    return (
      <div
        className="absolute inset-0 flex flex-col"
        style={{ display: isVisible ? 'flex' : 'none' }}
      >
        {/* Terminal output area — read-only on mobile */}
        <div ref={containerRef} className="flex-1 min-h-0" />

        {/* Mobile input bar */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-t bg-muted/30 shrink-0">
          <input
            ref={mobileInputRef}
            type="text"
            value={mobileInput}
            onChange={(e) => setMobileInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleMobileSend();
              }
            }}
            placeholder="Type command..."
            className="flex-1 bg-background border rounded px-3 py-1.5 text-sm font-mono outline-none focus:ring-1 focus:ring-primary"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleMobileSend}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ display: isVisible ? 'block' : 'none' }}
    />
  );
}
