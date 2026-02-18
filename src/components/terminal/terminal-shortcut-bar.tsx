'use client';

import { useState, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/stores/terminal-store';

/** Shortcut keys for the mobile accessory bar (Termius-style) */
const SHORTCUT_KEYS: { label: string; input?: string; modifier?: 'ctrl' | 'alt'; icon?: React.ReactNode }[] = [
  { label: 'esc', input: '\x1b' },
  { label: 'tab', input: '\t' },
  { label: 'ctrl', modifier: 'ctrl' },
  { label: 'alt', modifier: 'alt' },
  { label: '/', input: '/' },
  { label: '|', input: '|' },
  { label: '~', input: '~' },
  { label: '-', input: '-' },
  { label: '^C', input: '\x03' },
  // Arrow keys — ANSI escape sequences
  { label: '↑', input: '\x1b[A', icon: <ChevronUp className="h-4 w-4" /> },
  { label: '↓', input: '\x1b[B', icon: <ChevronDown className="h-4 w-4" /> },
  { label: '←', input: '\x1b[D', icon: <ChevronLeft className="h-4 w-4" /> },
  { label: '→', input: '\x1b[C', icon: <ChevronRight className="h-4 w-4" /> },
];

export function TerminalShortcutBar() {
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const sendInput = useTerminalStore((s) => s.sendInput);

  const ctrlRef = useRef(false);
  const altRef = useRef(false);
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);

  const clearModifiers = useCallback(() => {
    ctrlRef.current = false;
    altRef.current = false;
    setCtrlActive(false);
    setAltActive(false);
  }, []);

  const handleKey = useCallback((key: typeof SHORTCUT_KEYS[number]) => {
    if (!activeTabId) return;

    if (key.modifier === 'ctrl') {
      const next = !ctrlRef.current;
      ctrlRef.current = next;
      altRef.current = false;
      setCtrlActive(next);
      setAltActive(false);
      return;
    }
    if (key.modifier === 'alt') {
      const next = !altRef.current;
      altRef.current = next;
      ctrlRef.current = false;
      setAltActive(next);
      setCtrlActive(false);
      return;
    }

    if (key.input) {
      sendInput(activeTabId, key.input);
      clearModifiers();
    }
  }, [activeTabId, sendInput, clearModifiers]);

  if (!activeTabId) return null;

  return (
    <div
      className="flex items-center gap-1 px-1.5 py-1.5 border-t bg-muted/50 shrink-0 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {SHORTCUT_KEYS.map((key) => {
        const isModifier = !!key.modifier;
        const isActive =
          (key.modifier === 'ctrl' && ctrlActive) ||
          (key.modifier === 'alt' && altActive);

        return (
          <button
            key={key.label}
            onPointerDown={(e) => {
              e.preventDefault();
              handleKey(key);
            }}
            className={cn(
              'min-w-[36px] h-[34px] px-2.5 text-sm font-mono rounded-md shrink-0 select-none',
              'flex items-center justify-center',
              'active:scale-90 transition-transform duration-75',
              isActive
                ? 'bg-primary text-primary-foreground'
                : isModifier
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-muted text-foreground',
            )}
          >
            {key.icon ?? key.label}
          </button>
        );
      })}
    </div>
  );
}
