'use client';

/**
 * Toolbar/header row for the git graph section.
 * Contains expand/collapse toggle, branch filter, and fetch/pull/push/refresh action buttons.
 */

import { ChevronRight, ChevronDown, RefreshCw, ArrowUpFromLine, ArrowDownToLine, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface GitGraphToolbarHeaderProps {
  isExpanded: boolean;
  filter: 'current' | 'all';
  loading: boolean;
  actionLoading: string | null;
  onToggleExpand: () => void;
  onToggleFilter: () => void;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onRefresh: () => void;
}

export function GitGraphToolbarHeader({
  isExpanded,
  filter,
  loading,
  actionLoading,
  onToggleExpand,
  onToggleFilter,
  onFetch,
  onPull,
  onPush,
  onRefresh,
}: GitGraphToolbarHeaderProps) {
  const t = useTranslations('git');
  const tCommon = useTranslations('common');

  return (
    <div
      className={cn(
        'group flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
        'hover:bg-accent/30 transition-colors rounded-sm cursor-pointer'
      )}
      onClick={onToggleExpand}
    >
      {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      <span className="flex-1">Graph</span>

      {/* Action loading label */}
      {actionLoading && (
        <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
          {t(`${actionLoading}ing` as 'fetching' | 'pulling' | 'pushing')}
        </span>
      )}

      <div className="flex items-center gap-0.5">
        {/* Branch filter toggle */}
        <button
          className={cn('p-0.5 hover:bg-accent rounded', filter === 'current' && 'bg-accent')}
          onClick={(e) => { e.stopPropagation(); onToggleFilter(); }}
          title={filter === 'current' ? t('showAllBranches') : t('showCurrentBranchOnly')}
        >
          <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
            {filter === 'current' ? (
              <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 1.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" />
            ) : (
              <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM3.5 8a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
            )}
          </svg>
        </button>

        <button
          className="p-0.5 hover:bg-accent rounded"
          onClick={(e) => { e.stopPropagation(); onFetch(); }}
          disabled={actionLoading !== null}
          title={actionLoading === 'fetch' ? t('fetching') : t('fetch')}
        >
          <ArrowDownToLine className={cn('size-3.5', actionLoading === 'fetch' && 'animate-pulse')} />
        </button>

        <button
          className="p-0.5 hover:bg-accent rounded"
          onClick={(e) => { e.stopPropagation(); onPull(); }}
          disabled={actionLoading !== null}
          title={actionLoading === 'pull' ? t('pulling') : t('pull')}
        >
          <RotateCcw className={cn('size-3.5', actionLoading === 'pull' && 'animate-spin')} />
        </button>

        <button
          className="p-0.5 hover:bg-accent rounded"
          onClick={(e) => { e.stopPropagation(); onPush(); }}
          disabled={actionLoading !== null}
          title={actionLoading === 'push' ? t('pushing') : t('push')}
        >
          <ArrowUpFromLine className={cn('size-3.5', actionLoading === 'push' && 'animate-pulse')} />
        </button>

        <button
          className="p-0.5 hover:bg-accent rounded"
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          title={tCommon('refresh')}
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}
