/**
 * CodeMirror Extension: Inline AI Code Editing
 *
 * Provides Ctrl/Cmd+I shortcut for inline AI-powered code editing.
 * Shows inline diff preview with removed lines (red) and added lines (green).
 */

import { EditorView, Decoration, DecorationSet, keymap, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, Extension, Prec, RangeSetBuilder } from '@codemirror/state';
import type { DiffResult, DiffLine } from '@/lib/diff-generator';

/**
 * Selection info extracted from editor
 */
export interface InlineEditSelection {
  from: number;
  to: number;
  text: string;
  startLine: number;
  endLine: number;
}

/**
 * Diff state for rendering
 */
export interface InlineEditDiffState {
  selection: InlineEditSelection;
  originalCode: string;
  generatedCode: string;
  diff: DiffResult;
  status: 'preview';
}

/**
 * Configuration for inline-edit extension
 */
export interface InlineEditConfig {
  /** Callback when Ctrl/Cmd+I is pressed with selection */
  onEditRequest: (selection: InlineEditSelection) => void;
  /** Callback when accept button is clicked */
  onAccept: () => void;
  /** Callback when reject button is clicked */
  onReject: () => void;
  /** Whether extension is enabled */
  enabled?: boolean;
}

// State effects for managing diff preview
export const setInlineDiff = StateEffect.define<InlineEditDiffState | null>();

/**
 * Widget to show added lines (green) in the diff
 */
class AddedLinesWidget extends WidgetType {
  constructor(
    readonly lines: DiffLine[],
    readonly startLineNumber: number
  ) {
    super();
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'cm-inline-edit-added-block';

    let lineNum = this.startLineNumber;
    for (const line of this.lines) {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'cm-inline-edit-added-line';

      // Line number
      const lineNumSpan = document.createElement('span');
      lineNumSpan.className = 'cm-inline-edit-line-number';
      lineNumSpan.textContent = String(lineNum++);

      // Plus prefix
      const prefix = document.createElement('span');
      prefix.className = 'cm-inline-edit-prefix';
      prefix.textContent = '+';

      // Code content
      const content = document.createElement('span');
      content.className = 'cm-inline-edit-content';
      content.textContent = line.content;

      lineDiv.appendChild(lineNumSpan);
      lineDiv.appendChild(prefix);
      lineDiv.appendChild(content);
      container.appendChild(lineDiv);
    }

    return container;
  }

  eq(other: AddedLinesWidget) {
    return (
      this.lines.length === other.lines.length &&
      this.startLineNumber === other.startLineNumber &&
      this.lines.every((l, i) => l.content === other.lines[i].content)
    );
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * State field to track diff preview and provide decorations
 */
export const inlineDiffField = StateField.define<{
  diffState: InlineEditDiffState | null;
  decorations: DecorationSet;
}>({
  create: () => ({ diffState: null, decorations: Decoration.none }),

  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setInlineDiff)) {
        const diffState = effect.value;
        if (!diffState || !diffState.diff) {
          return { diffState: null, decorations: Decoration.none };
        }
        const decorations = buildDiffDecorations(tr.state.doc, diffState);
        return { diffState, decorations };
      }
    }

    // If document changed while preview is active, clear it
    if (tr.docChanged && value.diffState) {
      return { diffState: null, decorations: Decoration.none };
    }

    return value;
  },

  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

/**
 * Build decorations for diff preview - git-style with red/green lines
 */
function buildDiffDecorations(
  doc: { line: (n: number) => { from: number; to: number } },
  diffState: InlineEditDiffState
): DecorationSet {
  const { selection, diff } = diffState;
  const builder = new RangeSetBuilder<Decoration>();

  console.log('[InlineEdit] Building decorations for selection:', selection.startLine, '-', selection.endLine);
  console.log('[InlineEdit] Diff lines:', diff.lines.map(l => `${l.type}: ${l.content.substring(0, 30)}...`));

  // Group consecutive added lines to insert as a single widget
  const addedGroups: { afterLine: number; lines: DiffLine[]; startLineNum: number }[] = [];
  let currentAddedGroup: DiffLine[] = [];
  let lastRemovedOrUnchangedLine = selection.startLine - 1;

  // Track which original lines have been processed
  let originalLineNum = selection.startLine;
  // Track what line number new lines will get
  let newLineNum = selection.startLine;

  for (const diffLine of diff.lines) {
    if (diffLine.type === 'removed') {
      // Flush any pending added lines before this removed line
      if (currentAddedGroup.length > 0) {
        addedGroups.push({
          afterLine: lastRemovedOrUnchangedLine,
          lines: currentAddedGroup,
          startLineNum: newLineNum - currentAddedGroup.length,
        });
        currentAddedGroup = [];
      }

      // Add mark decoration for removed line (covers entire line content)
      if (originalLineNum <= selection.endLine) {
        const line = doc.line(originalLineNum);
        console.log('[InlineEdit] Adding removed decoration at line', originalLineNum, 'from', line.from, 'to', line.to);
        // Use mark decoration to highlight the entire line content
        builder.add(
          line.from,
          line.to,
          Decoration.mark({ class: 'cm-inline-edit-removed-mark' })
        );
        lastRemovedOrUnchangedLine = originalLineNum;
        originalLineNum++;
      }
      // Removed lines don't increment newLineNum
    } else if (diffLine.type === 'added') {
      // Collect added lines
      currentAddedGroup.push(diffLine);
      newLineNum++;
    } else {
      // Unchanged line
      if (currentAddedGroup.length > 0) {
        addedGroups.push({
          afterLine: lastRemovedOrUnchangedLine,
          lines: currentAddedGroup,
          startLineNum: newLineNum - currentAddedGroup.length,
        });
        currentAddedGroup = [];
      }
      lastRemovedOrUnchangedLine = originalLineNum;
      originalLineNum++;
      newLineNum++;
    }
  }

  // Flush remaining added lines
  if (currentAddedGroup.length > 0) {
    addedGroups.push({
      afterLine: lastRemovedOrUnchangedLine,
      lines: currentAddedGroup,
      startLineNum: newLineNum - currentAddedGroup.length,
    });
  }

  // Convert builder to set, then add widgets
  let decorations = builder.finish();

  // Add widget decorations for added lines groups
  for (const group of addedGroups) {
    const line = doc.line(Math.max(selection.startLine, Math.min(group.afterLine, selection.endLine)));
    const widget = Decoration.widget({
      widget: new AddedLinesWidget(group.lines, group.startLineNum),
      block: true,
      side: 1, // After the line
    });
    decorations = decorations.update({
      add: [widget.range(line.to)],
    });
  }

  return decorations;
}

/**
 * Create the inline-edit extension
 */
export function inlineEditExtension(config: InlineEditConfig): Extension {
  const { onEditRequest, onAccept, onReject, enabled = true } = config;

  if (!enabled) {
    return [];
  }

  // Keymap for Ctrl/Cmd+I
  const inlineEditKeymap = keymap.of([
    {
      key: 'Mod-i',
      run: (view) => {
        const selection = view.state.selection.main;

        // Need a selection
        if (selection.empty) {
          return false;
        }

        const doc = view.state.doc;
        const text = doc.sliceString(selection.from, selection.to);
        const startLine = doc.lineAt(selection.from).number;
        const endLine = doc.lineAt(selection.to).number;

        onEditRequest({
          from: selection.from,
          to: selection.to,
          text,
          startLine,
          endLine,
        });

        return true;
      },
    },
  ]);

  // Keymap for accepting/rejecting when preview is shown
  const previewKeymap = keymap.of([
    {
      key: 'Enter',
      run: (view) => {
        const { diffState } = view.state.field(inlineDiffField);
        if (diffState?.status === 'preview') {
          onAccept();
          return true;
        }
        return false;
      },
    },
    {
      key: 'Escape',
      run: (view) => {
        const { diffState } = view.state.field(inlineDiffField);
        if (diffState?.status === 'preview') {
          onReject();
          return true;
        }
        return false;
      },
    },
  ]);

  // CSS theme for diff styling
  const theme = EditorView.theme({
    // Removed line mark — red strikethrough highlight on the actual text
    '.cm-inline-edit-removed-mark': {
      backgroundColor: 'rgba(248, 81, 73, 0.2)',
      textDecoration: 'line-through',
      textDecorationColor: 'rgba(248, 81, 73, 0.6)',
    },
    // Added lines block container
    '.cm-inline-edit-added-block': {
      marginLeft: '0',
      borderLeft: '3px solid #3fb950',
      backgroundColor: 'rgba(63, 185, 80, 0.08)',
    },
    '.cm-inline-edit-added-line': {
      backgroundColor: 'rgba(63, 185, 80, 0.15)',
      padding: '0',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      lineHeight: '1.5',
      whiteSpace: 'pre',
      display: 'flex',
      alignItems: 'center',
      minHeight: '1.4em',
    },
    '.cm-inline-edit-line-number': {
      minWidth: '32px',
      paddingRight: '8px',
      paddingLeft: '8px',
      textAlign: 'right',
      color: '#7d8590',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      userSelect: 'none',
      flexShrink: '0',
    },
    '.cm-inline-edit-prefix': {
      color: '#3fb950',
      fontWeight: '600',
      width: '20px',
      textAlign: 'center',
      userSelect: 'none',
      flexShrink: '0',
    },
    '.cm-inline-edit-content': {
      flex: '1',
      color: '#e6edf3',
    },
  });

  return [
    inlineDiffField,
    Prec.highest(previewKeymap), // High priority to capture Enter/Escape
    Prec.highest(inlineEditKeymap), // High priority to override bracket matching
    theme,
  ];
}

// Legacy export for compatibility
export const inlineDiffState = inlineDiffField;

/**
 * Helper to dispatch diff state to editor
 */
export function dispatchInlineDiff(view: EditorView, diffState: InlineEditDiffState | null): void {
  view.dispatch({
    effects: setInlineDiff.of(diffState),
  });
}
