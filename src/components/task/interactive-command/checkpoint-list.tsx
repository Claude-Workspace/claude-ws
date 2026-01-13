'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Clock, MessageSquare, Loader2, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInteractiveCommandStore } from '@/stores/interactive-command-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Checkpoint {
  id: string;
  taskId: string;
  attemptId: string;
  sessionId: string;
  gitCommitHash: string | null;
  messageCount: number;
  summary: string | null;
  createdAt: number;
  attempt?: {
    displayPrompt: string | null;
    prompt: string;
  };
}

interface CheckpointListProps {
  taskId: string;
}

export function CheckpointList({ taskId }: CheckpointListProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rewinding, setRewinding] = useState(false);
  const { closeCommand, setError } = useInteractiveCommandStore();

  // Reset state when taskId changes
  useEffect(() => {
    setSelectedId(null);
    setRewinding(false);
    setError(null);
  }, [taskId, setError]);

  // Fetch checkpoints
  useEffect(() => {
    async function fetchCheckpoints() {
      try {
        const res = await fetch(`/api/checkpoints?taskId=${taskId}`);
        if (!res.ok) throw new Error('Failed to fetch checkpoints');
        const data = await res.json();
        setCheckpoints(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load checkpoints');
      } finally {
        setLoading(false);
      }
    }
    fetchCheckpoints();
  }, [taskId, setError]);

  // Handle rewind
  const handleRewind = async () => {
    if (!selectedId) return;
    const selectedCheckpoint = checkpoints.find((c) => c.id === selectedId);
    setRewinding(true);
    try {
      const res = await fetch('/api/checkpoints/rewind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkpointId: selectedId,
          rewindFiles: true, // Always rewind files if git commit exists
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to rewind');
      }
      const data = await res.json();

      // Show success message with details
      const hasFileRewind = data.sdkRewind?.success;
      toast.success(
        hasFileRewind
          ? `Rewound conversation & files to checkpoint`
          : `Rewound conversation to checkpoint`,
        {
          description: hasFileRewind
            ? `Files restored via SDK checkpointing`
            : selectedCheckpoint?.gitCommitHash
              ? 'File rewind failed, conversation only'
              : 'No file checkpoint for this attempt'
        }
      );

      // Success - close and refresh
      closeCommand();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rewind');
    } finally {
      setRewinding(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = checkpoints.findIndex((c) => c.id === selectedId);
        const nextIndex = Math.min(currentIndex + 1, checkpoints.length - 1);
        const nextId = checkpoints[nextIndex]?.id || null;
        setSelectedId(nextId);

        // Scroll selected element into view
        setTimeout(() => {
          const container = document.querySelector('[data-checkpoint-list]');
          const element = container?.querySelector(`[data-checkpoint-id="${nextId}"]`) as HTMLElement;
          if (element && container) {
            container.scrollTop = element.offsetTop - container.offsetTop;
          }
        }, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = checkpoints.findIndex((c) => c.id === selectedId);
        const prevIndex = Math.max(currentIndex - 1, 0);
        const prevId = checkpoints[prevIndex]?.id || null;
        setSelectedId(prevId);

        // Scroll selected element into view
        setTimeout(() => {
          const container = document.querySelector('[data-checkpoint-list]');
          const element = container?.querySelector(`[data-checkpoint-id="${prevId}"]`) as HTMLElement;
          if (element && container) {
            container.scrollTop = element.offsetTop - container.offsetTop;
          }
        }, 0);
      } else if (e.key === 'Enter' && selectedId) {
        e.preventDefault();
        handleRewind();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkpoints, selectedId]);

  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <RotateCcw className="size-8 mb-2 opacity-50" />
        <p className="text-sm">No checkpoints yet</p>
        <p className="text-xs mt-1">Checkpoints are created after each successful interaction</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-80">
      {/* Scrollable checkpoint list */}
      <div className="flex-1 overflow-y-auto divide-y" data-checkpoint-list>
        {checkpoints.map((checkpoint, index) => (
          <button
            key={checkpoint.id}
            data-checkpoint-id={checkpoint.id}
            onClick={() => setSelectedId(checkpoint.id)}
            onDoubleClick={handleRewind}
            className={cn(
              'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
              'hover:bg-muted/50',
              selectedId === checkpoint.id && 'bg-primary/10 border-l-2 border-primary'
            )}
          >
            <div className="shrink-0 pt-0.5">
              <div
                className={cn(
                  'size-2 rounded-full',
                  index === 0 ? 'bg-primary' : 'bg-muted-foreground/50'
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium truncate">
                  {checkpoint.attempt?.displayPrompt || checkpoint.attempt?.prompt || `Checkpoint ${index + 1}`}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatDate(checkpoint.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3" />
                  {checkpoint.messageCount} messages
                </span>
                {checkpoint.gitCommitHash && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400" title={`Checkpoint: ${checkpoint.gitCommitHash}`}>
                    <FileCheck className="size-3" />
                    File checkpoint
                  </span>
                )}
              </div>
              {checkpoint.summary && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {checkpoint.summary}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Fixed action footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t shrink-0">
        <p className="text-xs text-muted-foreground">
          <kbd className="px-1 bg-muted rounded">↑↓</kbd> navigate
          <span className="mx-2">·</span>
          <kbd className="px-1 bg-muted rounded">Enter</kbd> rewind
        </p>
        <Button
          size="sm"
          disabled={!selectedId || rewinding}
          onClick={handleRewind}
        >
          {rewinding ? (
            <Loader2 className="size-4 animate-spin mr-1" />
          ) : (
            <RotateCcw className="size-4 mr-1" />
          )}
          Rewind
        </Button>
      </div>
    </div>
  );
}
