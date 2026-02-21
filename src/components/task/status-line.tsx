'use client';

import { useEffect, useState } from 'react';
import { Clock, TrendingUp, GitBranch, Workflow, Gauge } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSocket } from '@/hooks/use-socket';
import { cn } from '@/lib/utils';
import type { UsageStats } from '@/lib/usage-tracker';
import type { GitStats } from '@/lib/git-stats-collector';

interface WorkflowSummary {
  chain: string[];
  completedCount: number;
  activeCount: number;
  totalCount: number;
}

interface StatusLineProps {
  taskId: string;
  currentAttemptId: string | null;
  className?: string;
}

/**
 * StatusLine - Display real-time tracking information below task input
 *
 * Shows three sections:
 * 1. Usage (tokens, cost, time)
 * 2. Git Stats (file changes)
 * 3. Workflow (subagent chain)
 *
 * Always visible when task is open, shows data from:
 * - Current running attempt (real-time)
 * - Last completed attempt (if no running attempt)
 */
export function StatusLine({ taskId, currentAttemptId, className }: StatusLineProps) {
  const t = useTranslations('task');
  const socket = useSocket();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [gitStats, setGitStats] = useState<GitStats | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowSummary | null>(null);

  // Reset state when task changes (not when attemptId changes)
  useEffect(() => {
    setUsage(null);
    setGitStats(null);
    setWorkflow(null);
  }, [taskId]);

  // Subscribe to tracking events
  useEffect(() => {
    if (!socket || !currentAttemptId) return;

    console.log('[StatusLine] Subscribing to room for attemptId:', currentAttemptId);

    // Join the attempt room to receive events
    socket.emit('attempt:subscribe', { attemptId: currentAttemptId });

    // Usage updates
    const handleUsageUpdate = (data: { attemptId: string; usage: UsageStats }) => {
      console.log('[StatusLine] Usage update:', data);
      if (data.attemptId === currentAttemptId) {
        setUsage(data.usage);
      }
    };

    // Workflow updates
    const handleWorkflowUpdate = (data: { attemptId: string; workflow: WorkflowSummary }) => {
      console.log('[StatusLine] Workflow update:', data);
      if (data.attemptId === currentAttemptId) {
        setWorkflow(data.workflow);
      }
    };

    // Git stats (on completion)
    const handleGitStats = (data: { attemptId: string; stats: GitStats }) => {
      console.log('[StatusLine] Git stats:', data);
      if (data.attemptId === currentAttemptId) {
        setGitStats(data.stats);
      }
    };

    socket.on('status:usage', handleUsageUpdate);
    socket.on('status:workflow', handleWorkflowUpdate);
    socket.on('status:git', handleGitStats);

    return () => {
      socket.off('status:usage', handleUsageUpdate);
      socket.off('status:workflow', handleWorkflowUpdate);
      socket.off('status:git', handleGitStats);
    };
  }, [socket, currentAttemptId]);

  // Always render when task is open
  const hasData = usage || gitStats || workflow;
  const hasRunningAttempt = !!currentAttemptId;

  return (
    <div
      className={cn(
        'px-3 py-2 border-t bg-muted/20 text-xs text-muted-foreground',
        'flex items-center gap-4 flex-wrap',
        className
      )}
    >
      {/* Show status based on state */}
      {!hasRunningAttempt && !hasData && (
        <div className="flex items-center gap-1.5 text-muted-foreground/50">
          <TrendingUp className="size-3.5" />
          <span>{t('noAttemptRunning')}</span>
        </div>
      )}

      {hasRunningAttempt && !hasData && (
        <div className="flex items-center gap-1.5 text-muted-foreground/50">
          <TrendingUp className="size-3.5 animate-pulse" />
          <span>{t('waitingForTracking')}</span>
        </div>
      )}

      {/* Context Usage Section (like /context in Claude Code) */}
      {usage && usage.contextUsed > 0 && (
        <div className="flex items-center gap-1.5">
          <Gauge className={cn(
            'size-3.5',
            usage.contextHealth?.status === 'HEALTHY' && 'text-green-500',
            usage.contextHealth?.status === 'WARNING' && 'text-yellow-500',
            usage.contextHealth?.status === 'CRITICAL' && 'text-orange-500',
            usage.contextHealth?.status === 'EMERGENCY' && 'text-red-500'
          )} />
          <span className={cn(
            'font-medium',
            usage.contextHealth?.status === 'HEALTHY' && 'text-green-600',
            usage.contextHealth?.status === 'WARNING' && 'text-yellow-600',
            usage.contextHealth?.status === 'CRITICAL' && 'text-orange-600',
            usage.contextHealth?.status === 'EMERGENCY' && 'text-red-600'
          )}>
            {usage.contextPercentage.toFixed(1)}%
          </span>
          <span className="text-muted-foreground/70">
            of {formatTokenCount(usage.contextLimit)}
          </span>
          {usage.contextHealth && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              usage.contextHealth.status === 'HEALTHY' && 'bg-green-500/10 text-green-600',
              usage.contextHealth.status === 'WARNING' && 'bg-yellow-500/10 text-yellow-600',
              usage.contextHealth.status === 'CRITICAL' && 'bg-orange-500/10 text-orange-600',
              usage.contextHealth.status === 'EMERGENCY' && 'bg-red-500/10 text-red-600'
            )}>
              {usage.contextHealth.status}
            </span>
          )}
        </div>
      )}

      {/* Token Usage Section */}
      {usage && (
        <div className="flex items-center gap-1.5">
          <TrendingUp className="size-3.5" />
          <span className="font-medium">
            {usage.totalTokens.toLocaleString()} {t('tokens')}
          </span>
          {usage.totalCostUSD > 0 && (
            <span className="text-muted-foreground/70">
              (${usage.totalCostUSD.toFixed(4)})
            </span>
          )}
          {usage.numTurns > 0 && (
            <span className="text-muted-foreground/70">
              · {usage.numTurns} {usage.numTurns === 1 ? t('turn') : t('turns')}
            </span>
          )}
          {usage.durationMs > 0 && (
            <span className="text-muted-foreground/70 flex items-center gap-1">
              · <Clock className="size-3" /> {formatDuration(usage.durationMs)}
            </span>
          )}
        </div>
      )}

      {/* Git Stats Section */}
      {gitStats && gitStats.filesChanged > 0 && (
        <div className="flex items-center gap-1.5">
          <GitBranch className="size-3.5" />
          <span className="font-medium text-green-600">
            +{gitStats.additions}
          </span>
          <span className="font-medium text-red-600">
            -{gitStats.deletions}
          </span>
          <span className="text-muted-foreground/70">
            ({gitStats.filesChanged} {gitStats.filesChanged === 1 ? t('file') : t('files')})
          </span>
        </div>
      )}

      {/* Workflow Section */}
      {workflow && workflow.totalCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Workflow className="size-3.5" />
          <span className="font-medium">
            {workflow.chain.slice(0, 3).join(' → ')}
            {workflow.chain.length > 3 && ' ...'}
          </span>
          <span className="text-muted-foreground/70">
            ({workflow.completedCount}/{workflow.totalCount} done)
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Format token count to human-readable string (e.g., 200K)
 */
function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }
  return tokens.toLocaleString();
}
