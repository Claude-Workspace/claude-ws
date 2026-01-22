'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useTheme } from 'next-themes';
import { languages } from './languages';
import { gotoDefinitionExtension, type ExtractedSymbol, type DefinitionInfo } from './extensions/goto-definition';
import { DefinitionPopup } from './definition-popup';
import { useSidebarStore } from '@/stores/sidebar-store';

interface EditorPosition {
  lineNumber?: number;
  column?: number;
  matchLength?: number;
}

interface CodeEditorWithDefinitionsProps {
  value: string;
  onChange: (value: string) => void;
  language?: string | null;
  readOnly?: boolean;
  className?: string;
  editorPosition?: EditorPosition | null;
  focusOnNavigate?: boolean;
  /** File path for definition lookups */
  filePath?: string;
  /** Base project path */
  basePath?: string;
  /** Whether to enable go-to-definition */
  enableDefinitions?: boolean;
}

/**
 * CodeMirror editor with Go to Definition support
 */
export function CodeEditorWithDefinitions({
  value,
  onChange,
  language,
  readOnly = false,
  className,
  editorPosition,
  focusOnNavigate = true,
  filePath,
  basePath,
  enableDefinitions = true,
}: CodeEditorWithDefinitionsProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const [height, setHeight] = useState<number>(400);

  // Definition popup state
  const [definitionPopup, setDefinitionPopup] = useState<{
    definition: DefinitionInfo | null;
    position: { x: number; y: number } | null;
  }>({ definition: null, position: null });

  // Sidebar store for navigation
  const { openTab, setEditorPosition, setSelectedFile, expandFolder } = useSidebarStore();

  // Check if current theme is a dark theme
  const isDarkTheme = theme?.includes('dark') || false;

  // Calculate actual container height for proper scrolling
  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setHeight(rect.height);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Navigate to line and highlight text when editorPosition changes
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view || !editorPosition?.lineNumber) return;

    const { lineNumber, column = 0, matchLength = 0 } = editorPosition;

    // Small delay to ensure editor is ready
    setTimeout(() => {
      if (!editorViewRef.current) return;

      // Get position from line number (CodeMirror lines are 1-indexed)
      const line = editorViewRef.current.state.doc.line(lineNumber);

      // Calculate position for selection
      const startPos = line.from + (column || 0);
      const endPos = matchLength > 0 ? startPos + matchLength : line.to;

      // Scroll to position
      editorViewRef.current.dispatch({
        effects: EditorView.scrollIntoView(startPos, { y: 'center', x: 'center' }),
      });

      // Set selection to highlight the match
      editorViewRef.current.dispatch({
        selection: { anchor: startPos, head: endPos },
      });

      // Focus the editor only if focusOnNavigate is true
      if (focusOnNavigate) {
        editorViewRef.current.focus();
      }
    }, 100);
  }, [editorPosition, focusOnNavigate]);

  // Handle definition request
  const handleDefinitionRequest = useCallback(
    async (symbol: ExtractedSymbol, _view: EditorView): Promise<DefinitionInfo | null> => {
      if (!filePath || !basePath) {
        console.warn('Go to Definition: filePath or basePath not provided');
        return null;
      }

      try {
        const response = await fetch('/api/language/definition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            basePath,
            filePath,
            symbol: symbol.text,
            line: symbol.line,
            column: symbol.column,
            language,
            fileContent: value,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return { found: false, error: error.error || 'Failed to resolve definition' };
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Definition request error:', error);
        return {
          found: false,
          error: error instanceof Error ? error.message : 'Network error',
        };
      }
    },
    [filePath, basePath, language, value]
  );

  // Handle navigation to definition
  const handleNavigate = useCallback(
    (definition: DefinitionInfo) => {
      if (!definition.found || !definition.definition) return;

      const { filePath: defPath, line, column, symbol } = definition.definition;

      // Expand parent folders in file tree
      const parts = defPath.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += (i > 0 ? '/' : '') + parts[i];
        expandFolder(currentPath);
      }

      // Open file in tab
      openTab(defPath);

      // Set selected file
      setSelectedFile(defPath);

      // Navigate to position
      setEditorPosition({
        lineNumber: line,
        column: column,
        matchLength: symbol.length,
      });
    },
    [openTab, setSelectedFile, setEditorPosition, expandFolder]
  );

  // Handle show preview popup
  const handleShowPreview = useCallback(
    (definition: DefinitionInfo, position: { x: number; y: number }) => {
      setDefinitionPopup({ definition, position });
    },
    []
  );

  // Handle hide preview popup
  const handleHidePreview = useCallback(() => {
    setDefinitionPopup({ definition: null, position: null });
  }, []);

  // Get language extension based on file language
  const extensions = useMemo(() => {
    const langExtension = language ? languages[language] : null;

    const baseExtensions = [
      // Enable line wrapping
      EditorView.lineWrapping,
      // Always override background to transparent
      EditorView.theme({
        '&': { backgroundColor: 'transparent !important' },
        '.cm-scroller': { backgroundColor: 'transparent !important' },
        '.cm-content': { backgroundColor: 'transparent !important' },
        '.cm-line': { backgroundColor: 'transparent !important' },
        '.cm-layer': { backgroundColor: 'transparent !important' },
        '.cm-gutters': { backgroundColor: 'rgb(255 255 255 / 3%) !important' },
        '.cm-lineNumbers': { backgroundColor: 'rgb(255 255 255 / 3%) !important' },
        '.cm-lineNumbers .cm-gutterElement': { backgroundColor: 'rgb(255 255 255 / 3%) !important' },
      }),
      // Apply oneDark theme for dark themes
      ...(isDarkTheme ? [oneDark] : []),
      ...(langExtension ? [langExtension()] : []),
    ];

    // Add go-to-definition extension if enabled
    if (enableDefinitions && filePath && basePath) {
      baseExtensions.push(
        gotoDefinitionExtension({
          onDefinitionRequest: handleDefinitionRequest,
          onNavigate: handleNavigate,
          onShowPreview: handleShowPreview,
          onHidePreview: handleHidePreview,
          enabled: true,
        })
      );
    }

    return baseExtensions;
  }, [
    language,
    isDarkTheme,
    enableDefinitions,
    filePath,
    basePath,
    handleDefinitionRequest,
    handleNavigate,
    handleShowPreview,
    handleHidePreview,
  ]);

  // Capture editor view when created
  const handleCreateEditor = useCallback((view: EditorView) => {
    editorViewRef.current = view;
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ height: className ? undefined : '100%' }}>
      <CodeMirror
        value={value}
        height={`${height}px`}
        extensions={extensions}
        onChange={onChange}
        readOnly={readOnly}
        onCreateEditor={handleCreateEditor}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          searchKeymap: false,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />

      {/* Definition popup */}
      <DefinitionPopup
        definition={definitionPopup.definition}
        position={definitionPopup.position}
        onClose={handleHidePreview}
      />
    </div>
  );
}
