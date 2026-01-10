'use client';

import { formatDistanceToNow as formatDateDistance } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Attempt } from '@/types';

interface AttemptItemProps {
  attempt: Attempt;
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
}

const STATUS_VARIANTS = {
  running: { variant: 'secondary' as const, label: 'Running', color: 'text-yellow-600' },
  completed: { variant: 'secondary' as const, label: 'Completed', color: 'text-green-600' },
  failed: { variant: 'destructive' as const, label: 'Failed', color: 'text-red-600' },
  cancelled: { variant: 'outline' as const, label: 'Cancelled', color: 'text-muted-foreground' },
};

export function AttemptItem({ attempt, onClick, isActive, className }: AttemptItemProps) {
  const statusConfig = STATUS_VARIANTS[attempt.status];
  const hasDiff = attempt.diffAdditions > 0 || attempt.diffDeletions > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/50',
        isActive && 'bg-muted border-primary',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            #{attempt.id.slice(0, 8)}
          </span>
          <Badge variant={statusConfig.variant} className={cn('text-xs', statusConfig.color)}>
            {statusConfig.label}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateDistance(new Date(attempt.createdAt), { addSuffix: true })}
        </span>
      </div>

      <p className="text-sm line-clamp-2 mb-2">{attempt.prompt}</p>

      {hasDiff && (
        <div className="flex items-center gap-3 text-xs">
          {attempt.diffAdditions > 0 && (
            <span className="text-green-600">+{attempt.diffAdditions}</span>
          )}
          {attempt.diffDeletions > 0 && (
            <span className="text-red-600">-{attempt.diffDeletions}</span>
          )}
        </div>
      )}

      {attempt.branch && (
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="font-mono">{attempt.branch}</span>
        </div>
      )}
    </button>
  );
}

