import { EditorView } from '@codemirror/view';

/**
 * Cursor & selection overrides for CodeMirror editor.
 *
 * Dark theme uses {dark: true} to match oneDark's specificity
 * (oneDark scopes with .cm-dark class — we must do the same to override).
 * Placed AFTER oneDark so source order wins at equal specificity.
 */

export const cursorSelectionDark = EditorView.theme(
  {
    // Stop cursor blink — CM6 blinks via animation on the layer
    '& .cm-cursorLayer': {
      animation: 'none !important',
    },
    // Cursor — solid white to override oneDark's #528bff
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#ffffff',
      borderLeftWidth: '3px',
    },
    '.cm-content': {
      caretColor: '#ffffff',
    },

    // Active line
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },

    // Selection — translucent blue
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'rgba(99, 148, 237, 0.35)',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(99, 148, 237, 0.22)',
    },
    '.cm-content ::selection': {
      backgroundColor: 'rgba(99, 148, 237, 0.35)',
    },

    // Selection match (other occurrences) — subtle amber
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(245, 158, 11, 0.22)',
    },
  },
  { dark: true }
);

export const cursorSelectionLight = EditorView.theme({
  // Stop cursor blink
  '& .cm-cursorLayer': {
    animation: 'none !important',
  },
  // Cursor — solid dark
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#1a1a1a',
    borderLeftWidth: '3px',
  },
  '.cm-content': {
    caretColor: '#1a1a1a',
  },

  // Active line
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },

  // Selection — soft blue tint
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  '.cm-content ::selection': {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },

  // Selection match
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
});
