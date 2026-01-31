'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCode } from 'lucide-react';
import { useZIndexStore } from '@/stores/z-index-store';

/**
 * Definition information to display
 */
interface DefinitionInfo {
  found: boolean;
  definition?: {
    filePath: string;
    line: number;
    column: number;
    symbol: string;
    kind: string;
  };
  preview?: {
    content: string;
    startLine: number;
    endLine: number;
    language: string;
  };
  error?: string;
}

/**
 * Props for DefinitionPopup component
 */
interface DefinitionPopupProps {
  /** Definition info to display */
  definition: DefinitionInfo | null;
  /** Position to display popup */
  position: { x: number; y: number } | null;
  /** Called when popup should close */
  onClose: () => void;
}

/**
 * Simple syntax highlighting for preview
 * Uses regex-based highlighting for common patterns
 */
function highlightCode(code: string, language: string): string {
  // Keywords for different languages
  const keywords: Record<string, string[]> = {
    typescript: [
      'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum',
      'import', 'export', 'from', 'default', 'async', 'await', 'return',
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
      'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'extends',
      'implements', 'public', 'private', 'protected', 'static', 'readonly',
      'abstract', 'override', 'declare', 'namespace', 'module', 'as', 'in',
      'of', 'typeof', 'instanceof', 'keyof', 'void', 'never', 'unknown', 'any',
    ],
    javascript: [
      'const', 'let', 'var', 'function', 'class', 'import', 'export', 'from',
      'default', 'async', 'await', 'return', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally',
      'throw', 'new', 'this', 'super', 'extends', 'typeof', 'instanceof',
    ],
    python: [
      'def', 'class', 'import', 'from', 'as', 'return', 'if', 'elif', 'else',
      'for', 'while', 'try', 'except', 'finally', 'raise', 'with', 'pass',
      'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False',
      'lambda', 'yield', 'global', 'nonlocal', 'assert', 'async', 'await',
    ],
  };

  // Escape HTML
  let result = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Get keywords for language
  const langKeywords = keywords[language] || keywords.typescript || [];

  // Highlight strings (single and double quotes, template literals)
  result = result.replace(
    /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g,
    '<span class="text-green-400">$&</span>'
  );

  // Highlight comments
  result = result.replace(
    /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm,
    '<span class="text-gray-500 italic">$&</span>'
  );

  // Highlight numbers
  result = result.replace(
    /\b(\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/gi,
    '<span class="text-orange-400">$1</span>'
  );

  // Highlight keywords
  const keywordPattern = new RegExp(
    `\\b(${langKeywords.join('|')})\\b`,
    'g'
  );
  result = result.replace(
    keywordPattern,
    '<span class="text-purple-400 font-medium">$1</span>'
  );

  // Highlight types (PascalCase words)
  result = result.replace(
    /\b([A-Z][a-zA-Z0-9]*)\b/g,
    '<span class="text-cyan-400">$1</span>'
  );

  return result;
}

/**
 * Definition preview popup component
 * Shows definition location and code preview
 */
export function DefinitionPopup({
  definition,
  position,
  onClose,
}: DefinitionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Get z-index on mount
  const [zIndex] = useState(() => useZIndexStore.getState().getNextZIndex());

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Calculate adjusted position (show above cursor)
  const adjustedPosition = useMemo(() => {
    if (!position) return null;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;

    let x = position.x;
    // Position popup above the cursor
    let y = position.y - 300;

    const width = 630;

    if (x + width > viewportWidth - 20) {
      x = viewportWidth - width - 20;
    }
    if (x < 20) {
      x = 20;
    }

    // If not enough space above, show below
    if (y < 20) {
      y = position.y + 25;
    }

    return { x, y };
  }, [position]);

  // Highlighted preview content
  const previewContent = definition?.preview?.content;
  const previewLanguage = definition?.preview?.language;
  const highlightedPreview = useMemo(() => {
    if (!previewContent) return '';
    return highlightCode(previewContent, previewLanguage || 'typescript');
  }, [previewContent, previewLanguage]);

  // Don't render if no definition or position
  if (!definition || !adjustedPosition) {
    return null;
  }

  const { found, definition: def, preview, error } = definition;

  return createPortal(
    <div
      ref={popupRef}
      className="fixed bg-popover border border-border rounded-md shadow-lg overflow-hidden"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        maxWidth: 'min(630px, calc(100vw - 40px))',
        maxHeight: 'min(360px, calc(100vh - 40px))',
        zIndex,
      }}
    >
      {/* Header - file path only */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        {found && def ? (
          <>
            <FileCode className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate" title={def.filePath}>
              {def.filePath}
            </span>
            <span className="text-xs text-muted-foreground">
              :{def.line}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            {error || 'Definition not found'}
          </span>
        )}
      </div>

      {/* Preview */}
      {found && preview && (
        <div className="overflow-auto max-h-[280px] bg-background">
          <pre className="p-3 text-sm font-mono leading-relaxed">
            <code dangerouslySetInnerHTML={{ __html: highlightedPreview }} />
          </pre>
        </div>
      )}
    </div>,
    document.body
  );
}
