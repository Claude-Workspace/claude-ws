'use client';

import { useState, useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, TextCursorInput, X, Copy, ClipboardPaste, TextSelect } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/stores/terminal-store';
import { useTranslations } from 'next-intl';

/**
 * Mobile paste: always show dialog, pre-fill from clipboard if possible.
 * Clipboard API on mobile is unreliable (returns empty, hangs, or denies silently),
 * so the dialog is the primary UX — clipboard just pre-fills it.
 */
function showPasteDialog(): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);';
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--background,#1e1e1e);color:var(--foreground,#d4d4d4);border-radius:12px;padding:16px;width:90%;max-width:340px;display:flex;flex-direction:column;gap:10px;font-family:system-ui,sans-serif;';
    card.innerHTML = `
      <div style="font-size:14px;font-weight:600;">Paste</div>
      <textarea rows="4" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid var(--border,#333);background:var(--muted,#2d2d2d);color:inherit;padding:8px;font-size:14px;resize:none;" placeholder="Long-press here → Paste"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button data-action="cancel" style="padding:6px 14px;border-radius:6px;border:1px solid var(--border,#333);background:transparent;color:inherit;font-size:13px;cursor:pointer;">Cancel</button>
        <button data-action="ok" style="padding:6px 14px;border-radius:6px;border:none;background:var(--primary,#2563eb);color:#fff;font-size:13px;cursor:pointer;">Submit</button>
      </div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const textarea = card.querySelector('textarea') as HTMLTextAreaElement;
    const cleanup = () => overlay.remove();
    const submit = () => { cleanup(); resolve(textarea.value || null); };
    const cancel = () => { cleanup(); resolve(null); };

    // Try pre-fill from clipboard (best-effort, don't block on failure)
    navigator.clipboard.readText()
      .then((t) => { if (t && !textarea.value) textarea.value = t; })
      .catch(() => {});

    textarea.focus();
    card.querySelector('[data-action="cancel"]')?.addEventListener('click', cancel);
    card.querySelector('[data-action="ok"]')?.addEventListener('click', submit);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
  });
}

/** Max px movement to still count as a tap (not a swipe) */
const TAP_THRESHOLD = 8;

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
  const t = useTranslations('shells');
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const sendInput = useTerminalStore((s) => s.sendInput);
  const selectionMode = useTerminalStore((s) => activeTabId ? s.selectionMode[activeTabId] : false);
  const setSelectionMode = useTerminalStore((s) => s.setSelectionMode);
  const copySelection = useTerminalStore((s) => s.copySelection);
  const selectAll = useTerminalStore((s) => s.selectAll);
  const pasteText = useTerminalStore((s) => s.pasteText);

  const ctrlRef = useRef(false);
  const altRef = useRef(false);
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);

  /** Paste: show dialog (pre-filled from clipboard if possible), then xterm.paste() */
  const handlePaste = useCallback(async () => {
    if (!activeTabId) return;
    const text = await showPasteDialog();
    if (text) pasteText(activeTabId, text);
  }, [activeTabId, pasteText]);

  const clearModifiers = useCallback(() => {
    ctrlRef.current = false;
    altRef.current = false;
    setCtrlActive(false);
    setAltActive(false);
  }, []);

  // Tap-vs-swipe guard: track pointer start, only fire action on pointerUp if barely moved
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const onDown = useCallback((e: ReactPointerEvent) => {
    e.preventDefault(); // keep terminal focus
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const isTap = useCallback((e: ReactPointerEvent) => {
    if (!pointerStart.current) return false;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    pointerStart.current = null;
    return dx < TAP_THRESHOLD && dy < TAP_THRESHOLD;
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

  const btnBase = cn(
    'min-w-[36px] h-[34px] px-2.5 text-sm font-mono rounded-md shrink-0 select-none',
    'flex items-center justify-center',
    'active:scale-90 transition-transform duration-75',
  );

  // Selection mode bar
  if (selectionMode) {
    return (
      <div
        className="flex items-center gap-1 px-1.5 py-1.5 border-t bg-muted/50 shrink-0"
        style={{ scrollbarWidth: 'none' }}
      >
        <span className="text-xs text-muted-foreground px-2 shrink-0">Selection</span>
        <div className="w-px h-5 bg-border shrink-0" />
        <button
          onPointerDown={onDown}
          onPointerUp={(e) => { if (isTap(e)) selectAll(activeTabId); }}
          className={cn(btnBase, 'bg-muted text-foreground gap-1')}
        >
          <TextSelect className="h-3.5 w-3.5" />
          All
        </button>
        <button
          onPointerDown={onDown}
          onPointerUp={(e) => {
            if (isTap(e)) {
              copySelection(activeTabId);
              setSelectionMode(activeTabId, false);
            }
          }}
          className={cn(btnBase, 'bg-muted text-foreground gap-1')}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>
        <button
          onPointerDown={onDown}
          onPointerUp={(e) => { if (isTap(e)) handlePaste(); }}
          className={cn(btnBase, 'bg-muted text-foreground gap-1')}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste
        </button>
        <div className="flex-1" />
        <button
          onPointerDown={onDown}
          onPointerUp={(e) => { if (isTap(e)) setSelectionMode(activeTabId, false); }}
          className={cn(btnBase, 'bg-muted text-muted-foreground')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Normal shortcut bar with select toggle prepended
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-1.5 border-t bg-muted/50 shrink-0 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      <button
        onPointerDown={onDown}
        onPointerUp={(e) => { if (isTap(e)) setSelectionMode(activeTabId, true); }}
        className={cn(btnBase, 'bg-muted text-muted-foreground')}
        title={t('selectionMode')}
      >
        <TextCursorInput className="h-4 w-4" />
      </button>
      <div className="w-px h-5 bg-border shrink-0" />
      {SHORTCUT_KEYS.map((key) => {
        const isModifier = !!key.modifier;
        const isActive =
          (key.modifier === 'ctrl' && ctrlActive) ||
          (key.modifier === 'alt' && altActive);

        return (
          <button
            key={key.label}
            onPointerDown={onDown}
            onPointerUp={(e) => { if (isTap(e)) handleKey(key); }}
            className={cn(
              btnBase,
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
