/**
 * CodeMirror Extension: Add Selection to Context
 *
 * Provides Ctrl/Cmd+L shortcut to add selected code to chat context.
 * Creates a line reference like @filename#L17-27
 */

import { EditorView, keymap } from '@codemirror/view';
import { Extension, Prec } from '@codemirror/state';

/**
 * Selection info for context mention
 */
export interface ContextSelection {
  filePath: string;
  fileName: string;
  startLine: number;
  endLine: number;
  text: string;
}

/**
 * Configuration for add-to-context extension
 */
export interface AddToContextConfig {
  /** Callback when Cmd/Ctrl+L is pressed with selection */
  onAddToContext: (selection: ContextSelection) => void;
  /** Current file path */
  filePath: string;
  /** Whether extension is enabled */
  enabled?: boolean;
}

/**
 * Extract selection info from editor
 */
function getSelectionInfo(view: EditorView, filePath: string): ContextSelection | null {
  const selection = view.state.selection.main;

  // Need actual selection (not just cursor)
  if (selection.empty) {
    return null;
  }

  const doc = view.state.doc;
  const startLine = doc.lineAt(selection.from).number;
  const endLine = doc.lineAt(selection.to).number;
  const text = view.state.sliceDoc(selection.from, selection.to);

  // Get just filename from path
  const fileName = filePath.split('/').pop() || filePath;

  return {
    filePath,
    fileName,
    startLine,
    endLine,
    text,
  };
}

/**
 * Create the add-to-context extension
 */
export function addToContextExtension(config: AddToContextConfig): Extension {
  const { onAddToContext, filePath, enabled = true } = config;

  if (!enabled) {
    return [];
  }

  // Keymap for Cmd/Ctrl+L
  const addToContextKeymap = keymap.of([
    {
      key: 'Mod-l',
      preventDefault: true,
      run: (view: EditorView) => {
        const selection = getSelectionInfo(view, filePath);
        if (selection) {
          onAddToContext(selection);
          return true;
        }
        return false;
      },
    },
  ]);

  // Use Prec.highest to override browser's default Cmd+L behavior
  return Prec.highest(addToContextKeymap);
}
