'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, FileText, FileCode, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useActiveProject } from '@/hooks/use-active-project';
import { cn } from '@/lib/utils';

interface FileResult { name: string; path: string; type: 'file' | 'directory'; score: number; matches: number[]; }
interface ContentMatch { lineNumber: number; line: string; column: number; matchLength: number; }
interface ContentResult { file: string; matches: ContentMatch[]; }

export interface SearchResults {
  fileResults: FileResult[];
  contentResults: ContentResult[];
  loading: boolean;
  query: string;
}

type SearchMode = 'all' | 'files' | 'content';

interface UnifiedSearchProps {
  onSearchChange: (results: SearchResults | null) => void;
  className?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * UnifiedSearch - Search input with mode filter tabs (files / content / all).
 * Calls onSearchChange with results; SearchResultsView renders them separately.
 */
export function UnifiedSearch({ onSearchChange, className, onRefresh, refreshing }: UnifiedSearchProps) {
  const t = useTranslations('sidebar');
  const activeProject = useActiveProject();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('all');

  // Debounced search effect
  useEffect(() => {
    if (!query.trim() || !activeProject?.path) {
      onSearchChange(null);
      return;
    }

    const controller = new AbortController();

    const search = async () => {
      setLoading(true);
      onSearchChange({ fileResults: [], contentResults: [], loading: true, query });

      try {
        let fileResults: FileResult[] = [];
        let contentResults: ContentResult[] = [];

        if (searchMode === 'all' || searchMode === 'files') {
          const filesRes = await fetch(
            `/api/search/files?q=${encodeURIComponent(query)}&basePath=${encodeURIComponent(activeProject.path)}&limit=50`,
            { signal: controller.signal }
          );
          if (filesRes.ok) {
            const data = await filesRes.json();
            fileResults = data.results || [];
          }
        }

        if (searchMode === 'all' || searchMode === 'content') {
          const contentRes = await fetch(
            `/api/search/content?q=${encodeURIComponent(query)}&basePath=${encodeURIComponent(activeProject.path)}&maxFiles=20&limit=10`,
            { signal: controller.signal }
          );
          if (contentRes.ok) {
            const data = await contentRes.json();
            contentResults = data.results || [];
          }
        }

        onSearchChange({ fileResults, contentResults, loading: false, query });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Search failed:', error);
        }
        onSearchChange({ fileResults: [], contentResults: [], loading: false, query });
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(search, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, activeProject?.path, onSearchChange, searchMode]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearchChange(null);
    inputRef.current?.focus();
  }, [onSearchChange]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            searchMode === 'content'
              ? t('searchContent')
              : searchMode === 'files'
              ? t('searchFiles')
              : t('searchAll')
          }
          className="pl-8 pr-16 h-8 text-sm"
          data-slot="unified-search-input"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {query && (
            <Button variant="ghost" size="icon" className="size-6" onClick={handleClear}>
              <X className="size-3" />
            </Button>
          )}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={onRefresh}
              disabled={refreshing}
              title={t('refreshFileTree')}
            >
              <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Search mode filter tabs */}
      <div className="flex items-center gap-1 px-1">
        <button
          onClick={() => setSearchMode('files')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors',
            searchMode === 'files'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          <FileText className="size-3.5" />
          {t('filesTab')}
        </button>
        <button
          onClick={() => setSearchMode('content')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors',
            searchMode === 'content'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          <FileCode className="size-3.5" />
          {t('contentTab')}
        </button>
        <button
          onClick={() => setSearchMode('all')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors',
            searchMode === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          {t('allTab')}
        </button>
      </div>
    </div>
  );
}

// Re-export SearchResultsView so existing imports via unified-search keep working
export { SearchResultsView } from './unified-search-results-view';
