'use client';

import { useMemo, useCallback, type ReactNode } from 'react';
import { FileCode } from 'lucide-react';
import { detectFilePaths, resolveFilePath, type DetectedFilePath } from '@/lib/file-path-detector';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';

interface ClickableFilePathProps {
  /** The file path to display */
  filePath: string;
  /** Line number to navigate to (1-indexed) */
  lineNumber?: number;
  /** Column number (1-indexed) */
  column?: number;
  /** Display text (defaults to filePath) */
  displayText?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Renders a clickable file path that opens the file in the editor.
 */
export function ClickableFilePath({
  filePath,
  lineNumber,
  column,
  displayText,
  className,
}: ClickableFilePathProps) {
  const openTab = useSidebarStore((s) => s.openTab);
  const setPendingEditorPosition = useSidebarStore((s) => s.setPendingEditorPosition);
  const setIsOpen = useSidebarStore((s) => s.setIsOpen);
  const getActiveProject = useProjectStore((s) => s.getActiveProject);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const project = getActiveProject();
      if (!project) {
        console.warn('[ClickableFilePath] No active project, cannot open file');
        return;
      }

      // Resolve the file path relative to project root
      const absolutePath = resolveFilePath(filePath, project.path);
      console.log('[ClickableFilePath] Opening file:', { filePath, absolutePath, lineNumber, column });

      // Open the file in a new tab
      openTab(absolutePath);

      // If line number specified, set pending position
      if (lineNumber) {
        setPendingEditorPosition({
          filePath: absolutePath,
          lineNumber,
          column,
        });
      }

      // Ensure sidebar is open to show the editor
      setIsOpen(true);
    },
    [filePath, lineNumber, column, openTab, setPendingEditorPosition, setIsOpen, getActiveProject]
  );

  const display = displayText || filePath + (lineNumber ? `:${lineNumber}` : '') + (column ? `:${column}` : '');

  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 px-1 py-0.5 rounded',
        'text-primary hover:text-primary/80',
        'bg-primary/5 hover:bg-primary/10',
        'transition-colors cursor-pointer',
        'font-mono text-[13px]',
        className
      )}
      title={`Open ${filePath}${lineNumber ? ` at line ${lineNumber}` : ''}`}
    >
      <FileCode className="size-3 flex-shrink-0" />
      <span className="underline decoration-dotted underline-offset-2">{display}</span>
    </button>
  );
}

interface FilePathTextProps {
  /** Text content that may contain file paths */
  children: string;
  /** Additional class names for the container */
  className?: string;
}

/**
 * Renders text content with file paths converted to clickable links.
 * Preserves the original text structure while making file paths interactive.
 */
export function FilePathText({ children: text, className }: FilePathTextProps) {
  const elements = useMemo(() => {
    const detectedPaths = detectFilePaths(text);

    if (detectedPaths.length === 0) {
      return [text];
    }

    const result: ReactNode[] = [];
    let lastIndex = 0;

    detectedPaths.forEach((detected, index) => {
      // Add text before this path
      if (detected.startIndex > lastIndex) {
        result.push(text.slice(lastIndex, detected.startIndex));
      }

      // Check if wrapped in backticks (remove them from display)
      const isBacktickWrapped = detected.fullMatch.startsWith('`') && detected.fullMatch.endsWith('`');
      const displayPath = isBacktickWrapped
        ? detected.fullMatch.slice(1, -1)
        : detected.fullMatch;

      // Add clickable file path
      result.push(
        <ClickableFilePath
          key={`path-${index}-${detected.startIndex}`}
          filePath={detected.filePath}
          lineNumber={detected.lineNumber}
          column={detected.column}
          displayText={displayPath}
        />
      );

      lastIndex = detected.endIndex;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  }, [text]);

  return <span className={className}>{elements}</span>;
}
