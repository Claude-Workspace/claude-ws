'use client';

import { Network, X, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkflowStore, type WorkflowEntry } from '@/stores/workflow-store';
import { useTaskStore } from '@/stores/task-store';
import { cn } from '@/lib/utils';
import type { SubagentNode, AgentMessage } from '@/lib/workflow-tracker';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function StatusIcon({ status }: { status: SubagentNode['status'] }) {
  switch (status) {
    case 'completed':
      return <span className="text-green-500 text-xs shrink-0">&#10003;</span>;
    case 'in_progress':
      return <span className="text-blue-500 text-xs shrink-0 animate-pulse">&#9679;</span>;
    case 'failed':
      return <span className="text-red-500 text-xs shrink-0">&#10007;</span>;
    case 'orphaned':
      return <span className="text-yellow-500 text-xs shrink-0">&#8856;</span>;
    default:
      return <span className="text-muted-foreground text-xs shrink-0">&#9679;</span>;
  }
}

function WorkflowEntryItem({ entry }: { entry: WorkflowEntry }) {
  const { selectTask } = useTaskStore();
  const { closePanel } = useWorkflowStore();

  const handleGoToTask = () => {
    selectTask(entry.taskId);
    closePanel();
  };

  return (
    <div className="border-b border-border last:border-b-0 px-4 py-3">
      {/* Task header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium truncate">{entry.taskTitle}</span>
        <button
          onClick={handleGoToTask}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
        >
          <ExternalLink className="size-3" />
          Go to task
        </button>
      </div>

      {/* Agent tree */}
      <div className="space-y-1">
        {entry.nodes.map((node) => (
          <div
            key={node.id}
            className="flex items-center gap-1.5 text-xs"
            style={{ paddingLeft: node.depth * 16 }}
          >
            <StatusIcon status={node.status} />
            <span className="text-foreground truncate">
              {node.name || node.type}
            </span>
            {node.teamName && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                {node.teamName}
              </Badge>
            )}
            <span className="text-muted-foreground shrink-0 ml-auto">
              {node.status === 'in_progress'
                ? 'running...'
                : node.durationMs !== undefined
                  ? formatDuration(node.durationMs)
                  : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Messages */}
      {entry.messages.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
          {entry.messages.map((msg, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0">
                [{msg.fromType} &rarr; {msg.toType}]
              </span>
              <span className="truncate">&quot;{msg.summary}&quot;</span>
              <span className="shrink-0 ml-auto text-[10px]">
                {formatTimestamp(msg.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface WorkflowPanelProps {
  className?: string;
}

export function WorkflowPanel({ className }: WorkflowPanelProps) {
  const { isOpen, closePanel, workflows, getActiveAgentCount } = useWorkflowStore();
  const entries = Array.from(workflows.values());
  const activeAgentCount = getActiveAgentCount();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 sm:hidden"
        onClick={closePanel}
      />

      {/* Sidebar */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg z-50',
          'flex flex-col',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Network className="size-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Agent Workflow</h2>
            {activeAgentCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {activeAgentCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closePanel}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Network className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No active workflows</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Agent workflows will appear here when tasks use subagents
              </p>
            </div>
          ) : (
            entries.map((entry) => (
              <WorkflowEntryItem
                key={entry.attemptId}
                entry={entry}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
