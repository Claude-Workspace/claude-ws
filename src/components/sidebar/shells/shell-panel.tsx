'use client';

import { useEffect } from 'react';
import { Square, Terminal, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShellStore, type ShellInfo } from '@/stores/shell-store';
import { useTranslations } from 'next-intl';

interface ShellPanelProps {
  projectId: string;
  className?: string;
}

function ShellItem({ shell, onStop }: { shell: ShellInfo; onStop: () => void }) {
  const t = useTranslations('shells');
  // Truncate command for display
  const displayCommand = shell.command.length > 30
    ? shell.command.slice(0, 30) + '...'
    : shell.command;

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
      {/* Status indicator */}
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

      {/* Command */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs truncate" title={shell.command}>
          {displayCommand}
        </div>
        <div className="text-[10px] text-muted-foreground">
          PID: {shell.pid}
        </div>
      </div>

      {/* Stop button (only for running shells) */}
      {shell.isRunning && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={onStop}
          title={t('stopShell')}
        >
          <Square className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function ShellPanel({ projectId, className }: ShellPanelProps) {
  const { shells, loading, subscribeToProject, unsubscribe, stopShell } = useShellStore();

  useEffect(() => {
    if (projectId) {
      subscribeToProject(projectId);
    }

    return () => {
      unsubscribe();
    };
  }, [projectId, subscribeToProject, unsubscribe]);

  const shellList = Array.from(shells.values())
    .sort((a, b) => b.startedAt - a.startedAt); // Newest first
  const runningCount = shellList.filter((s) => s.isRunning).length;

  if (loading) {
    return (
      <div className={cn('p-2', className)}>
        <div className="text-xs text-muted-foreground">Loading shells...</div>
      </div>
    );
  }

  if (shellList.length === 0) {
    return null; // Don't show panel if no shells
  }

  return (
    <div className={cn('border-t pt-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-medium">
          Shells {runningCount > 0 && <span className="text-green-500">({runningCount} running)</span>}
        </h3>
      </div>

      {/* Shell list */}
      <div className="space-y-2">
        {shellList.map((shell) => (
          <ShellItem
            key={shell.shellId}
            shell={shell}
            onStop={() => stopShell(shell.shellId)}
          />
        ))}
      </div>
    </div>
  );
}
