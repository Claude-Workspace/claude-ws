'use client';

import { cn } from '@/lib/utils';
import type { GitFileStatusCode } from '@/types';

interface GitStatusBadgeProps {
  status: GitFileStatusCode;
  className?: string;
}

const statusConfig: Record<GitFileStatusCode, { label: string; color: string; title: string }> = {
  M: { label: 'M', color: 'text-orange-500', title: 'Modified' },
  A: { label: 'A', color: 'text-green-500', title: 'Added' },
  D: { label: 'D', color: 'text-red-500', title: 'Deleted' },
  R: { label: 'R', color: 'text-blue-500', title: 'Renamed' },
  U: { label: 'U', color: 'text-purple-500', title: 'Unmerged' },
  '?': { label: 'U', color: 'text-muted-foreground', title: 'Untracked' },
};

export function GitStatusBadge({ status, className }: GitStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig['M'];

  return (
    <span
      className={cn('font-mono text-xs font-semibold', config.color, className)}
      title={config.title}
    >
      {config.label}
    </span>
  );
}
