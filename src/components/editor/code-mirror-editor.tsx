'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useTheme } from 'next-themes';
import { languages } from './languages';
import { markerLineHighlightExtension } from './extensions/marker-line-highlight';
import { cursorSelectionDark, cursorSelectionLight } from './extensions/cursor-selection-theme';

interface EditorPosition {
  lineNumber?: number;
  column?: number;
  matchLength?: number;
}

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string | null;
  readOnly?: boolean;
  className?: string;
  editorPosition?: EditorPosition | null;
  focusOnNavigate?: boolean;
}

export function CodeMirrorEditor({
  value,
  onChange,
  language,
  readOnly = false,
  className,
  editorPosition,
  focusOnNavigate = true,
}: CodeMirrorEditorProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const [height, setHeight] = useState<number>(400);

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

      // Get position from line number (CodeMirror lines are 0-indexed)
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

  // Get language extension based on file language
  const extensions = useMemo(() => {
    const langExtension = language ? languages[language] : null;
    return [
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
      // Apply oneDark theme for dark themes, then cursor/selection overrides
      ...(isDarkTheme ? [oneDark, cursorSelectionDark] : [cursorSelectionLight]),
      // Highlight marker lines (>>>>> and <<<<<)
      ...markerLineHighlightExtension,
      ...(langExtension ? [langExtension()] : []),
    ];
  }, [language, isDarkTheme]);

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
    </div>
  );
}
