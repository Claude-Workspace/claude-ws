'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Terminal, Square, Circle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShellStore, type ShellInfo } from '@/stores/shell-store';
import { ShellLogView } from './shell-log-view';

interface ShellItemProps {
  shell: ShellInfo;
  isSelected: boolean;
  onSelect: () => void;
  onStop: () => void;
}

function ShellItem({ shell, isSelected, onSelect, onStop }: ShellItemProps) {
  const t = useTranslations('task');
  const displayCommand =
    shell.command.length > 40 ? shell.command.slice(0, 40) + '...' : shell.command;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md text-sm cursor-pointer transition-colors',
        isSelected ? 'bg-primary/20 ring-1 ring-primary/50' : 'bg-muted/50 hover:bg-muted'
      )}
    >
      <Circle
        className={cn(
          'h-2 w-2 flex-shrink-0',
          shell.isRunning
            ? 'fill-green-500 text-green-500'
            : shell.exitCode === 0
              ? 'fill-gray-400 text-gray-400'
              : 'fill-red-500 text-red-500'
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs truncate" title={shell.command}>
          {displayCommand}
        </div>
        <div className="text-[10px] text-muted-foreground">PID: {shell.pid}</div>
      </div>
      {shell.isRunning && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
          title={t('stopShell')}
        >
          <Square className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ============================================
// Toggle Bar - Always visible when shells exist
// ============================================
interface ShellToggleBarProps {
  projectId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ShellToggleBar({ projectId, isExpanded, onToggle }: ShellToggleBarProps) {
  const t = useTranslations('task');
  const { shells, subscribeToProject } = useShellStore();

  useEffect(() => {
    if (projectId) {
      subscribeToProject(projectId);
    }
  }, [projectId, subscribeToProject]);

  const shellList = Array.from(shells.values())
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => b.startedAt - a.startedAt); // Newest first
  const runningCount = shellList.filter((s) => s.isRunning).length;

  // Only show when there are running tasks
  if (runningCount === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t bg-muted/20"
    >
      {isExpanded ? (
        <ChevronDown className="h-3 w-3" />
      ) : (
        <ChevronUp className="h-3 w-3" />
      )}
      <Terminal className="h-3 w-3" />
      <span>
        {t('runningBackgroundTasks', { count: runningCount })}
      </span>
    </button>
  );
}

// ============================================
// Expanded Panel - Replaces input when active
// ============================================
interface ShellExpandedPanelProps {
  projectId: string;
  onClose: () => void;
  className?: string;
}

export function ShellExpandedPanel({ projectId, onClose, className }: ShellExpandedPanelProps) {
  const t = useTranslations('task');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewingShellId, setViewingShellId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { shells, stopShell } = useShellStore();

  const shellList = Array.from(shells.values())
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => b.startedAt - a.startedAt); // Newest first

  const selectedShell = shellList[selectedIndex];
  const viewingShell = viewingShellId
    ? shellList.find((s) => s.shellId === viewingShellId)
    : null;

  // Reset selection when shell list changes
  useEffect(() => {
    if (selectedIndex >= shellList.length) {
      setSelectedIndex(Math.max(0, shellList.length - 1));
    }
  }, [shellList.length, selectedIndex]);

  // Close log view if shell is removed
  useEffect(() => {
    if (viewingShellId && !shellList.find((s) => s.shellId === viewingShellId)) {
      setViewingShellId(null);
    }
  }, [shellList, viewingShellId]);

  // Keyboard navigation - now always active since input is hidden
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // When viewing logs, only Escape closes
      if (viewingShellId) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          setViewingShellId(null);
        }
        return;
      }

      // Shell list navigation
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopImmediatePropagation();
          onClose();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(shellList.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedShell) {
            setViewingShellId(selectedShell.shellId);
          }
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          if (selectedShell?.isRunning) {
            stopShell(selectedShell.shellId);
          }
          break;
      }
    },
    [viewingShellId, shellList.length, selectedShell, stopShell, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current) {
      const items = containerRef.current.querySelectorAll('[role="option"]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // If viewing logs, show log view
  if (viewingShell) {
    return (
      <div className={cn('p-3 sm:p-4', className)}>
        <ShellLogView
          shell={viewingShell}
          onClose={() => setViewingShellId(null)}
        />
      </div>
    );
  }

  return (
    <div className={cn('p-3 sm:p-4', className)}>
      <div
        ref={containerRef}
        role="listbox"
        className="space-y-1 max-h-48 overflow-y-auto p-1 -m-1"
      >
        {shellList.map((shell, idx) => (
          <ShellItem
            key={shell.shellId}
            shell={shell}
            isSelected={idx === selectedIndex}
            onSelect={() => setSelectedIndex(idx)}
            onStop={() => stopShell(shell.shellId)}
          />
        ))}
      </div>
      {/* Keyboard hints */}
      <div className="text-[10px] text-muted-foreground/60 pt-2 flex gap-3 justify-center">
        <span>↑↓ {t('navigateHint')}</span>
        <span>⏎ {t('viewLogsHint')}</span>
        <span>K {t('killHint')}</span>
        <span>Esc {t('closeHint')}</span>
      </div>
    </div>
  );
}

// ============================================
// Legacy combined component (for backward compat)
// ============================================
interface TaskShellIndicatorProps {
  projectId: string;
  className?: string;
}

export function TaskShellIndicator({ projectId, className }: TaskShellIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Arrow down to open (when typing in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isExpanded) return;

      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';

      // Only handle ArrowDown if the input is within the toggle bar's context
      // Find the closest parent with projectId attribute or check if it's in the same project context
      const isInContext = target.closest(`[data-project-id="${projectId}"]`) || target.closest('.task-detail-panel');

      if (e.key === 'ArrowDown' && isTyping && !e.shiftKey && !e.ctrlKey && !e.metaKey && isInContext) {
        const input = target as HTMLTextAreaElement | HTMLInputElement;
        const isAtEnd = input.selectionStart === input.value.length;

        if (isAtEnd) {
          e.preventDefault();
          setIsExpanded(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, projectId]);

  return (
    <div className={className}>
      <ShellToggleBar
        projectId={projectId}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />
      {isExpanded && (
        <ShellExpandedPanel
          projectId={projectId}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}
