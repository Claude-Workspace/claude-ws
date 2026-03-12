'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, FileText, FileCode, ChevronRight, ChevronDown } from 'lucide-react';
import { FileIcon } from './file-icon';
import { useSidebarStore } from '@/stores/sidebar-store';
import { highlightMatches } from '@/lib/fuzzy-match';
import type { SearchResults } from './unified-search';

/** Highlights matched character indices in a file name */
function HighlightedText({ text, matches }: { text: string; matches: number[] }) {
  const segments = highlightMatches(text, matches);
  return <>{segments.map((seg, i) => seg.isMatch
    ? <span key={i} className="text-[#d87756] font-semibold">{seg.text}</span>
    : <span key={i}>{seg.text}</span>)}</>;
}

/** Highlights a match range within a content line */
function HighlightedLine({ line, column, matchLength }: { line: string; column: number; matchLength: number }) {
  return (
    <>
      <span>{line.substring(0, column)}</span>
      <span className="text-[#d87756] font-semibold">{line.substring(column, column + matchLength)}</span>
      <span>{line.substring(column + matchLength)}</span>
    </>
  );
}

// --- Search Results View ---

interface SearchResultsViewProps {
  results: SearchResults;
  onFileSelect: (path: string, lineNumber?: number, column?: number, matchLength?: number) => void;
}

/**
 * SearchResultsView - Inline results panel that replaces the file tree while searching.
 * Shows file-name matches and content matches with expandable line previews.
 */
export function SearchResultsView({ results, onFileSelect }: SearchResultsViewProps) {
  const { setSelectedFile, openTab, setPendingEditorPosition } = useSidebarStore();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Auto-expand first few content results
  useEffect(() => {
    if (results.contentResults.length > 0) {
      setExpandedFiles(new Set(results.contentResults.slice(0, 3).map(r => r.file)));
    }
  }, [results.contentResults]);

  const handleFileClick = useCallback((path: string) => {
    setSelectedFile(path);
    openTab(path);
    onFileSelect(path);
  }, [onFileSelect, setSelectedFile, openTab]);

  const handleLineClick = useCallback((
    path: string,
    lineNumber: number,
    column: number,
    matchLength: number
  ) => {
    setSelectedFile(path);
    openTab(path);
    setPendingEditorPosition({ filePath: path, lineNumber, column, matchLength });
    onFileSelect(path, lineNumber, column, matchLength);
  }, [onFileSelect, setSelectedFile, openTab, setPendingEditorPosition]);

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
        No results for &quot;{results.query}&quot;
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
                <span className="text-xs text-muted-foreground truncate">{result.path}</span>
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
                <button
                  className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-accent text-left"
                  onClick={() => toggleContentFile(result.file)}
                >
                  {isExpanded
                    ? <ChevronDown className="size-4 text-muted-foreground" />
                    : <ChevronRight className="size-4 text-muted-foreground" />}
                  <FileIcon name={fileName} type="file" className="shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{fileName}</span>
                    <span className="text-xs text-muted-foreground truncate">{result.file}</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {result.matches.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="bg-muted/30">
                    {result.matches.slice(0, 10).map((match, idx) => (
                      <button
                        key={`${result.file}-${match.lineNumber}-${idx}`}
                        className="w-full flex items-start gap-2 px-3 py-1 hover:bg-accent text-left font-mono text-xs"
                        onClick={() => handleLineClick(result.file, match.lineNumber, match.column, match.matchLength)}
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
