'use client';

/**
 * CodeMirror Editor with Inline AI Editing Support
 *
 * Wraps CodeEditorWithDefinitions and adds inline AI edit functionality.
 * Press Ctrl/Cmd+I with selected code to trigger AI editing.
 */

import { useMemo, useRef, useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useTheme } from 'next-themes';
import { languages } from './languages';
import { gotoDefinitionExtension, type ExtractedSymbol, type DefinitionInfo } from './extensions/goto-definition';
import {
  inlineEditExtension,
  dispatchInlineDiff,
  type InlineEditSelection,
  type InlineEditDiffState,
} from './extensions/inline-edit';
import { addToContextExtension, type ContextSelection } from './extensions/add-to-context';
import { DefinitionPopup } from './definition-popup';
import { InlineEditDialog } from './inline-edit-dialog';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useInlineEdit } from '@/hooks/use-inline-edit';
import { useInlineEditStore } from '@/stores/inline-edit-store';
import { useContextMentionStore } from '@/stores/context-mention-store';
import { useTaskStore } from '@/stores/task-store';
import { useState } from 'react';
import { toast } from 'sonner';

interface EditorPosition {
  lineNumber?: number;
  column?: number;
  matchLength?: number;
}

interface CodeEditorWithInlineEditProps {
  value: string;
  onChange: (value: string) => void;
  language?: string | null;
  readOnly?: boolean;
  className?: string;
  editorPosition?: EditorPosition | null;
  focusOnNavigate?: boolean;
  /** File path for definition and inline edit */
  filePath?: string;
  /** Base project path */
  basePath?: string;
  /** Whether to enable go-to-definition */
  enableDefinitions?: boolean;
  /** Whether to enable inline edit (Ctrl+I) */
  enableInlineEdit?: boolean;
}

export function CodeEditorWithInlineEdit({
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
  enableInlineEdit = true,
}: CodeEditorWithInlineEditProps) {
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

  // Inline edit store
  const { getSession } = useInlineEditStore();

  // Context mention store
  const { addLineMention } = useContextMentionStore();
  const { selectedTaskId } = useTaskStore();

  // Get screen position for selection (for popup positioning)
  const getSelectionPosition = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return null;

    const selection = view.state.selection.main;
    const coords = view.coordsAtPos(selection.from);
    if (!coords) return null;

    return { x: coords.left, y: coords.top };
  }, []);

  // Inline edit hook
  const inlineEdit = useInlineEdit({
    filePath: filePath || '',
    basePath: basePath || '',
    language: language || 'text',
    getSelectionPosition,
    onAccept: useCallback(
      (generatedCode: string, selection: InlineEditSelection) => {
        const view = editorViewRef.current;
        if (!view) return;

        // Replace the selected code with generated code
        view.dispatch({
          changes: {
            from: selection.from,
            to: selection.to,
            insert: generatedCode,
          },
        });

        // Clear the diff preview
        dispatchInlineDiff(view, null);

        // Trigger onChange to update parent state
        const newDoc = view.state.doc.toString();
        onChange(newDoc);
      },
      [onChange]
    ),
    onReject: useCallback(() => {
      const view = editorViewRef.current;
      if (view) {
        dispatchInlineDiff(view, null);
      }
    }, []),
  });

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

    setTimeout(() => {
      if (!editorViewRef.current) return;

      const line = editorViewRef.current.state.doc.line(lineNumber);
      const startPos = line.from + (column || 0);
      const endPos = matchLength > 0 ? startPos + matchLength : line.to;

      editorViewRef.current.dispatch({
        effects: EditorView.scrollIntoView(startPos, { y: 'center', x: 'center' }),
      });

      editorViewRef.current.dispatch({
        selection: { anchor: startPos, head: endPos },
      });

      if (focusOnNavigate) {
        editorViewRef.current.focus();
      }
    }, 100);
  }, [editorPosition, focusOnNavigate]);

  // Update diff preview when session changes
  const session = filePath ? getSession(filePath) : null;
  const sessionStatus = session?.status;
  const sessionDiff = session?.diff;
  const sessionGeneratedCode = session?.generatedCode;
  const sessionSelection = session?.selection;
  const sessionOriginalCode = session?.originalCode;

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    if (sessionStatus === 'preview' && sessionDiff && sessionSelection && sessionOriginalCode) {
      const diffState: InlineEditDiffState = {
        selection: sessionSelection,
        originalCode: sessionOriginalCode,
        generatedCode: sessionGeneratedCode || '',
        diff: sessionDiff,
        status: 'preview',
      };
      dispatchInlineDiff(view, diffState);
    }
  }, [sessionStatus, sessionDiff, sessionGeneratedCode, sessionSelection, sessionOriginalCode]);

  // Handle definition request
  const handleDefinitionRequest = useCallback(
    async (symbol: ExtractedSymbol): Promise<DefinitionInfo | null> => {
      if (!filePath || !basePath) {
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

        return await response.json();
      } catch (error) {
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

      const parts = defPath.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += (i > 0 ? '/' : '') + parts[i];
        expandFolder(currentPath);
      }

      openTab(defPath);
      setSelectedFile(defPath);
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

  // Handle inline edit request (Ctrl+I)
  const handleEditRequest = useCallback(
    (selection: InlineEditSelection) => {
      inlineEdit.startEdit(selection);
    },
    [inlineEdit]
  );

  // Handle accept from extension
  const handleAccept = useCallback(() => {
    inlineEdit.accept();
  }, [inlineEdit]);

  // Handle reject from extension
  const handleReject = useCallback(() => {
    inlineEdit.reject();
  }, [inlineEdit]);

  // Handle add to context (Cmd+L)
  const handleAddToContext = useCallback(
    (selection: ContextSelection) => {
      if (!selectedTaskId) {
        toast.error('Select a task first to add context');
        return;
      }

      addLineMention(
        selectedTaskId,
        selection.fileName,
        selection.filePath,
        selection.startLine,
        selection.endLine
      );

      const lineRange = selection.startLine === selection.endLine
        ? `L${selection.startLine}`
        : `L${selection.startLine}-${selection.endLine}`;
      toast.success(`Added @${selection.fileName}#${lineRange} to context`);
    },
    [selectedTaskId, addLineMention]
  );

  // Build extensions
  const extensions = useMemo(() => {
    const langExtension = language ? languages[language] : null;

    const baseExtensions = [
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
      ...(isDarkTheme ? [oneDark] : []),
      ...(langExtension ? [langExtension()] : []),
    ];

    // Add go-to-definition extension
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

    // Add inline edit extension
    if (enableInlineEdit && filePath && basePath && !readOnly) {
      baseExtensions.push(
        inlineEditExtension({
          onEditRequest: handleEditRequest,
          onAccept: handleAccept,
          onReject: handleReject,
          enabled: true,
        })
      );
    }

    // Add context (Cmd+L) extension - always enabled when filePath exists
    if (filePath) {
      baseExtensions.push(
        addToContextExtension({
          onAddToContext: handleAddToContext,
          filePath,
          enabled: true,
        })
      );
    }

    return baseExtensions;
  }, [
    language,
    isDarkTheme,
    enableDefinitions,
    enableInlineEdit,
    filePath,
    basePath,
    readOnly,
    handleDefinitionRequest,
    handleNavigate,
    handleShowPreview,
    handleHidePreview,
    handleEditRequest,
    handleAccept,
    handleReject,
    handleAddToContext,
  ]);

  // Capture editor view when created
  const handleCreateEditor = useCallback((view: EditorView) => {
    editorViewRef.current = view;
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className || ''}`} style={{ height: className ? undefined : '100%' }}>
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

      {/* Inline edit dialog */}
      {filePath && (
        <InlineEditDialog
          filePath={filePath}
          onSubmit={inlineEdit.submitInstruction}
          onAccept={inlineEdit.accept}
          onReject={inlineEdit.reject}
        />
      )}
    </div>
  );
}
