/**
 * CodeMirror Extension: Inline AI Code Editing
 *
 * Provides Ctrl/Cmd+I shortcut for inline AI-powered code editing.
 * Shows inline diff preview with removed lines (red) and added lines (green).
 */

import { EditorView, Decoration, DecorationSet, keymap } from '@codemirror/view';
import { StateField, StateEffect, Extension, Prec } from '@codemirror/state';
import { buildDiffDecorations } from './inline-edit-diff-decoration-builder';

export type { InlineEditSelection, InlineEditDiffState, InlineEditConfig } from './inline-edit-types';

// State effects for managing diff preview
export const setInlineDiff = StateEffect.define<import('./inline-edit-types').InlineEditDiffState | null>();

/**
 * State field to track diff preview and provide decorations
 */
export const inlineDiffField = StateField.define<{
  diffState: import('./inline-edit-types').InlineEditDiffState | null;
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
 * Create the inline-edit extension
 */
export function inlineEditExtension(config: import('./inline-edit-types').InlineEditConfig): Extension {
  const { onEditRequest, onAccept, onReject, enabled = true } = config;

  if (!enabled) return [];

  // Keymap for Ctrl/Cmd+I — triggers inline edit on selection
  const inlineEditKeymap = keymap.of([
    {
      key: 'Mod-i',
      run: (view) => {
        const selection = view.state.selection.main;
        if (selection.empty) return false;

        const doc = view.state.doc;
        const text = doc.sliceString(selection.from, selection.to);
        const startLine = doc.lineAt(selection.from).number;
        const endLine = doc.lineAt(selection.to).number;

        onEditRequest({ from: selection.from, to: selection.to, text, startLine, endLine });
        return true;
      },
    },
  ]);

  // Keymap for accepting/rejecting when diff preview is shown
  const previewKeymap = keymap.of([
    {
      key: 'Enter',
      run: (view) => {
        const { diffState } = view.state.field(inlineDiffField);
        if (diffState?.status === 'preview') { onAccept(); return true; }
        return false;
      },
    },
    {
      key: 'Escape',
      run: (view) => {
        const { diffState } = view.state.field(inlineDiffField);
        if (diffState?.status === 'preview') { onReject(); return true; }
        return false;
      },
    },
  ]);

  // CSS theme for diff styling
  const theme = EditorView.theme({
    '.cm-inline-edit-removed-mark': {
      backgroundColor: 'rgba(248, 81, 73, 0.2)',
      textDecoration: 'line-through',
      textDecorationColor: 'rgba(248, 81, 73, 0.6)',
    },
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
    Prec.highest(previewKeymap),
    Prec.highest(inlineEditKeymap),
    theme,
  ];
}

// Legacy export for compatibility
export const inlineDiffState = inlineDiffField;

/**
 * Helper to dispatch diff state to editor
 */
export function dispatchInlineDiff(
  view: EditorView,
  diffState: import('./inline-edit-types').InlineEditDiffState | null
): void {
  view.dispatch({ effects: setInlineDiff.of(diffState) });
}
