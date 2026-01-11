'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader2, FileText, FileCode, ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileIcon } from './file-icon';
import { useActiveProject } from '@/hooks/use-active-project';
import { useSidebarStore } from '@/stores/sidebar-store';
import { cn } from '@/lib/utils';
import { highlightMatches } from '@/lib/fuzzy-match';

interface FileResult {
  name: string;
  path: string;
  type: 'file' | 'directory';
  score: number;
  matches: number[];
}

interface ContentMatch {
  lineNumber: number;
  line: string;
  column: number;
  matchLength: number;
}

interface ContentResult {
  file: string;
  matches: ContentMatch[];
}

export interface SearchResults {
  fileResults: FileResult[];
  contentResults: ContentResult[];
  loading: boolean;
  query: string;
}

interface UnifiedSearchProps {
  onSearchChange: (results: SearchResults | null) => void;
  className?: string;
}

export function UnifiedSearch({ onSearchChange, className }: UnifiedSearchProps) {
  const activeProject = useActiveProject();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Search effect
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
        // Parallel search: files and content
        const [filesRes, contentRes] = await Promise.all([
          fetch(`/api/search/files?q=${encodeURIComponent(query)}&basePath=${encodeURIComponent(activeProject.path)}&limit=50`, {
            signal: controller.signal,
          }),
          fetch(`/api/search/content?q=${encodeURIComponent(query)}&basePath=${encodeURIComponent(activeProject.path)}&maxFiles=20&limit=10`, {
            signal: controller.signal,
          }),
        ]);

        let fileResults: FileResult[] = [];
        let contentResults: ContentResult[] = [];

        if (filesRes.ok) {
          const data = await filesRes.json();
          fileResults = data.results || [];
        }

        if (contentRes.ok) {
          const data = await contentRes.json();
          contentResults = data.results || [];
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
  }, [query, activeProject?.path, onSearchChange]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearchChange(null);
    inputRef.current?.focus();
  }, [onSearchChange]);

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search files..."
        className="pl-8 pr-8 h-8 text-sm"
        data-slot="unified-search-input"
      />
      {query && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 size-6"
          onClick={handleClear}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}

// Inline search results view (replaces tree when searching)
interface SearchResultsViewProps {
  results: SearchResults;
  onFileSelect: (path: string) => void;
}

export function SearchResultsView({ results, onFileSelect }: SearchResultsViewProps) {
  const { setSelectedFile, setPreviewFile } = useSidebarStore();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Auto-expand first few content results
  useEffect(() => {
    if (results.contentResults.length > 0) {
      setExpandedFiles(new Set(results.contentResults.slice(0, 3).map(r => r.file)));
    }
  }, [results.contentResults]);

  const handleFileClick = useCallback((path: string) => {
    setSelectedFile(path);
    setPreviewFile(path);
    onFileSelect(path);
  }, [setSelectedFile, setPreviewFile, onFileSelect]);

  const toggleContentFile = useCallback((file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }, []);

  const getFileName = (path: string) => path.split('/').pop() || path;

  if (results.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasFileResults = results.fileResults.length > 0;
  const hasContentResults = results.contentResults.length > 0;
  const totalContentMatches = results.contentResults.reduce((sum, r) => sum + r.matches.length, 0);

  if (!hasFileResults && !hasContentResults) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No results for "{results.query}"
      </div>
    );
  }

  return (
    <div className="py-1">
      {/* File name matches */}
      {hasFileResults && (
        <div>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5 border-b">
            <FileText className="size-3.5" />
            Files ({results.fileResults.length})
          </div>
          {results.fileResults.map((result) => (
            <button
              key={result.path}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
              onClick={() => handleFileClick(result.path)}
            >
              <FileIcon name={result.name} type={result.type} className="shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">
                  <HighlightedText text={result.name} matches={result.matches} />
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {result.path}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Content matches */}
      {hasContentResults && (
        <div className={hasFileResults ? 'border-t' : ''}>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5 border-b">
            <FileCode className="size-3.5" />
            Content ({totalContentMatches} matches in {results.contentResults.length} files)
          </div>
          {results.contentResults.map((result) => {
            const isExpanded = expandedFiles.has(result.file);
            const fileName = getFileName(result.file);

            return (
              <div key={result.file}>
                {/* File header */}
                <button
                  className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-accent text-left"
                  onClick={() => toggleContentFile(result.file)}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                  <FileIcon name={fileName} type="file" className="shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{fileName}</span>
                    <span className="text-xs text-muted-foreground truncate">{result.file}</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {result.matches.length}
                  </span>
                </button>

                {/* Line matches */}
                {isExpanded && (
                  <div className="bg-muted/30">
                    {result.matches.slice(0, 10).map((match, idx) => (
                      <button
                        key={idx}
                        className="w-full flex items-start gap-2 px-3 py-1 hover:bg-accent text-left font-mono text-xs"
                        onClick={() => handleFileClick(result.file)}
                      >
                        <span className="text-muted-foreground w-8 text-right shrink-0">
                          {match.lineNumber}
                        </span>
                        <span className="truncate flex-1">
                          <HighlightedLine
                            line={match.line}
                            column={match.column}
                            matchLength={match.matchLength}
                          />
                        </span>
                      </button>
                    ))}
                    {result.matches.length > 10 && (
                      <div className="px-3 py-1 text-xs text-muted-foreground">
                        +{result.matches.length - 10} more matches
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Highlight matched characters in file name
function HighlightedText({ text, matches }: { text: string; matches: number[] }) {
  const segments = highlightMatches(text, matches);
  return (
    <>
      {segments.map((seg, i) =>
        seg.isMatch ? (
          <span key={i} className="text-primary font-bold">{seg.text}</span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

// Highlight match in content line
function HighlightedLine({ line, column, matchLength }: { line: string; column: number; matchLength: number }) {
  const before = line.substring(0, column);
  const match = line.substring(column, column + matchLength);
  const after = line.substring(column + matchLength);

  return (
    <>
      <span className="text-muted-foreground">{before}</span>
      <span className="bg-yellow-500/40 text-foreground font-semibold">{match}</span>
      <span className="text-muted-foreground">{after}</span>
    </>
  );
}
