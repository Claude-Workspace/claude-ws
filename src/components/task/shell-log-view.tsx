'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShellStore, type ShellInfo } from '@/stores/shell-store';

interface ShellLogViewProps {
  shell: ShellInfo;
  onClose: () => void;
  className?: string;
}

export function ShellLogView({ shell, onClose, className }: ShellLogViewProps) {
  const { shellLogs, getShellLogs } = useShellStore();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logs = shellLogs.get(shell.shellId) || [];

  // Fetch initial logs when mounted
  useEffect(() => {
    getShellLogs(shell.shellId);
  }, [shell.shellId, getShellLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Note: Escape key is handled by parent TaskShellIndicator

  return (
    <div className={cn('flex flex-col bg-background border-t', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs truncate" title={shell.command}>
            {shell.command}
          </div>
          <div className="text-[10px] text-muted-foreground">
            PID: {shell.pid} | {shell.isRunning ? 'Running' : `Exit: ${shell.exitCode}`}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Log content */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs bg-zinc-950 text-zinc-100 max-h-48"
      >
        {logs.length === 0 ? (
          <div className="text-zinc-500 italic">No output yet...</div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={`log-${log.timestamp}-${idx}`}
              className={cn(
                'whitespace-pre-wrap break-all',
                log.type === 'stderr' && 'text-red-400'
              )}
            >
              {log.content}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
