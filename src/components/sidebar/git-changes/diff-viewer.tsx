'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, X, FileCode, Plus, Minus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActiveProject } from '@/hooks/use-active-project';
import { useSidebarStore } from '@/stores/sidebar-store';
import { cn } from '@/lib/utils';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import type { GitDiff } from '@/types';
// Custom syntax highlighting theme in globals.css - no need for github-dark.css

// Register languages
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('java', java);

/**
 * Get language from file extension
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    css: 'css', scss: 'css', html: 'html', json: 'json', md: 'markdown',
  };
  return langMap[ext] || 'typescript';
}

/**
 * Syntax highlighting using highlight.js
 */
function highlightCode(code: string, language: string): string {
  try {
    const result = hljs.highlight(code, { language, ignoreIllegals: true });
    return result.value;
  } catch {
    // Fallback: just escape HTML
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

interface DiffViewerProps {
  filePath: string;
  staged: boolean;
  onClose: () => void;
}

interface DiffLine {
  type: 'addition' | 'deletion' | 'context' | 'header' | 'hunk';
  content: string;
  lineNumber?: { old?: number; new?: number };
}

export function DiffViewer({ filePath, staged, onClose }: DiffViewerProps) {
  const activeProject = useActiveProject();
  const { openTab, setPendingEditorPosition } = useSidebarStore();
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeProject?.path) return;

    // Skip if already fetched for this file/staged combination
    const fetchKey = `${filePath}:${staged}`;
    if (fetchedKeyRef.current === fetchKey) return;

    fetchedKeyRef.current = fetchKey;

    const fetchDiff = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          path: activeProject.path,
          file: filePath,
          staged: staged.toString(),
        });
        const res = await fetch(`/api/git/diff?${params}`);
        if (!res.ok) throw new Error('Failed to fetch diff');
        const data = await res.json();
        setDiff(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDiff();
  }, [activeProject?.path, filePath, staged]);

  const parseDiff = (rawDiff: string): DiffLine[] => {
    const lines: DiffLine[] = [];
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of rawDiff.split('\n')) {
      if (line.startsWith('diff ') || line.startsWith('index ')) {
        lines.push({ type: 'header', content: line });
      } else if (line.startsWith('---') || line.startsWith('+++')) {
        lines.push({ type: 'header', content: line });
      } else if (line.startsWith('@@')) {
        // Parse hunk header: @@ -start,count +start,count @@
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          oldLineNum = parseInt(match[1], 10);
          newLineNum = parseInt(match[2], 10);
        }
        lines.push({ type: 'hunk', content: line });
      } else if (line.startsWith('+')) {
        lines.push({
          type: 'addition',
          content: line.slice(1),
          lineNumber: { new: newLineNum++ },
        });
      } else if (line.startsWith('-')) {
        lines.push({
          type: 'deletion',
          content: line.slice(1),
          lineNumber: { old: oldLineNum++ },
        });
      } else {
        lines.push({
          type: 'context',
          content: line.startsWith(' ') ? line.slice(1) : line,
          lineNumber: { old: oldLineNum++, new: newLineNum++ },
        });
      }
    }

    return lines;
  };

  const fileName = filePath.split('/').pop() || filePath;
  const language = getLanguageFromPath(filePath);

  // Parse and highlight diff content
  const parsedLines = useMemo(() => {
    if (!diff?.diff) return [];
    return parseDiff(diff.diff);
  }, [diff?.diff]);

  // Handle clicking on a diff line to open file at that line
  const handleLineClick = (line: DiffLine) => {
    // Only allow clicking on lines with actual line numbers (addition, deletion, context)
    if (!line.lineNumber?.new && !line.lineNumber?.old) return;

    // Open the file in a new tab
    openTab(filePath);

    // Set pending editor position to be applied after file loads
    // Prefer the new line number for additions, fall back to old for deletions
    const lineNumber = line.lineNumber.new || line.lineNumber.old;
    if (lineNumber) {
      setPendingEditorPosition({
        filePath,
        lineNumber,
        column: 0,
        matchLength: 0
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate" title={filePath}>
            {fileName}
          </span>
          <span className="text-xs text-muted-foreground">
            ({staged ? 'staged' : 'unstaged'})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {diff && (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-0.5 text-teal-600">
                <Plus className="size-3" />
                {diff.additions}
              </span>
              <span className="flex items-center gap-0.5 text-red-600">
                <Minus className="size-3" />
                {diff.deletions}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full text-destructive text-sm">
          {error}
        </div>
      ) : diff && diff.diff ? (
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="font-mono text-xs min-w-max">
            {parsedLines.map((line, i) => {
              // Only highlight code lines (not headers/hunks)
              const shouldHighlight = line.type === 'addition' || line.type === 'deletion' || line.type === 'context';
              const highlightedContent = shouldHighlight
                ? highlightCode(line.content, language)
                : line.content;

              // Check if this line can be clicked (has line numbers)
              const canClick = line.lineNumber?.new || line.lineNumber?.old;

              return (
                <div
                  key={i}
                  className={cn(
                    'flex group',
                    line.type === 'addition' && 'bg-teal-500/15',
                    line.type === 'deletion' && 'bg-red-500/15',
                    line.type === 'header' && 'bg-muted/50 text-muted-foreground',
                    line.type === 'hunk' && 'bg-blue-500/10 text-blue-600',
                    canClick && 'hover:bg-accent/30 cursor-pointer'
                  )}
                  onClick={() => canClick && handleLineClick(line)}
                  title={canClick ? `Click to open file at line ${line.lineNumber?.new || line.lineNumber?.old}` : undefined}
                >
                  {/* Line number - single column */}
                  <div className="flex shrink-0 text-muted-foreground/60 select-none sticky left-0 bg-inherit z-10">
                    <span className="w-10 text-right pr-1 border-r border-border/50 bg-background">
                      {line.lineNumber?.new ?? line.lineNumber?.old ?? ''}
                    </span>
                  </div>
                  {/* Line content */}
                  <pre className="px-2 whitespace-pre">
                    {line.type === 'addition' && (
                      <span className="text-teal-700 dark:text-teal-400">+ </span>
                    )}
                    {line.type === 'deletion' && (
                      <span className="text-red-700 dark:text-red-400">- </span>
                    )}
                    {shouldHighlight ? (
                      <span dangerouslySetInnerHTML={{ __html: highlightedContent }} />
                    ) : (
                      line.content
                    )}
                  </pre>
                  {/* External link icon on hover */}
                  {canClick && (
                    <ExternalLink className="size-3 opacity-0 group-hover:opacity-50 ml-auto shrink-0 self-center text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          No changes to display
        </div>
      )}
    </div>
  );
}
