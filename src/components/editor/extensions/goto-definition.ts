// CodeMirror extension for Go to Definition
// - Hover: Show definition preview popup
// - Ctrl/Cmd + Click: Navigate directly to definition

import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
} from '@codemirror/view';
import { StateField, StateEffect, Extension } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

/**
 * Symbol info extracted from editor
 */
export interface ExtractedSymbol {
  text: string;
  from: number;
  to: number;
  line: number;
  column: number;
}

/**
 * Definition result from API
 */
export interface DefinitionInfo {
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
 * Configuration for goto-definition extension
 */
export interface GotoDefinitionConfig {
  /** Callback when definition is requested */
  onDefinitionRequest: (symbol: ExtractedSymbol, view: EditorView) => Promise<DefinitionInfo | null>;
  /** Callback when navigation is requested (Ctrl/Cmd + Click) */
  onNavigate: (definition: DefinitionInfo) => void;
  /** Callback when preview should be shown (hover) */
  onShowPreview?: (definition: DefinitionInfo, position: { x: number; y: number }) => void;
  /** Callback when preview should be hidden */
  onHidePreview?: () => void;
  /** Whether the extension is enabled */
  enabled?: boolean;
  /** Hover delay in ms before showing preview (default: 500) */
  hoverDelay?: number;
}

// State effect for hover position
const setHoverSymbol = StateEffect.define<ExtractedSymbol | null>();

// State field to track hovered symbol
const hoverSymbolState = StateField.define<ExtractedSymbol | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHoverSymbol)) {
        return effect.value;
      }
    }
    return value;
  },
});

// Decoration for underline on hover
const linkDecoration = Decoration.mark({
  class: 'cm-goto-definition-link',
});

/**
 * Extract symbol at position from editor
 */
function extractSymbolAtPosition(view: EditorView, pos: number): ExtractedSymbol | null {
  // Try to use syntax tree first
  const tree = syntaxTree(view.state);
  let node = tree.resolveInner(pos, 1);

  // Navigate up to find identifier node
  while (node && node.name !== 'VariableName' && node.name !== 'PropertyName' &&
         node.name !== 'Identifier' && node.name !== 'TypeName' &&
         !node.name.endsWith('Name') && node.parent) {
    if (node.from <= pos && node.to >= pos) {
      break;
    }
    node = node.parent;
  }

  // If we found a node, use its boundaries
  if (node && node.from < node.to) {
    const text = view.state.doc.sliceString(node.from, node.to);
    // Only use if it's a valid identifier
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(text)) {
      const line = view.state.doc.lineAt(node.from);
      return {
        text,
        from: node.from,
        to: node.to,
        line: line.number,
        column: node.from - line.from,
      };
    }
  }

  // Fallback: Extract word at position using regex
  const line = view.state.doc.lineAt(pos);
  const lineText = line.text;
  const posInLine = pos - line.from;

  // Find word boundaries
  let start = posInLine;
  let end = posInLine;

  // Expand to word boundaries
  while (start > 0 && /[a-zA-Z0-9_$]/.test(lineText[start - 1])) {
    start--;
  }
  while (end < lineText.length && /[a-zA-Z0-9_$]/.test(lineText[end])) {
    end++;
  }

  if (start === end) return null;

  const text = lineText.slice(start, end);

  // Validate it's an identifier
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(text)) return null;

  return {
    text,
    from: line.from + start,
    to: line.from + end,
    line: line.number,
    column: start,
  };
}

/**
 * Create the goto-definition extension
 */
export function gotoDefinitionExtension(config: GotoDefinitionConfig): Extension {
  const {
    onDefinitionRequest,
    onNavigate,
    onShowPreview,
    onHidePreview,
    enabled = true,
    hoverDelay = 500,
  } = config;

  if (!enabled) {
    return [];
  }

  // Debounce timer for hover
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let isShowingPreview = false;

  // Plugin to handle decorations
  const decorationPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.computeDecorations(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.state.field(hoverSymbolState) !== update.startState.field(hoverSymbolState)
        ) {
          this.decorations = this.computeDecorations(update.view);
        }
      }

      computeDecorations(view: EditorView): DecorationSet {
        const symbol = view.state.field(hoverSymbolState);

        if (!symbol) {
          return Decoration.none;
        }

        return Decoration.set([
          linkDecoration.range(symbol.from, symbol.to),
        ]);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  // Event handlers
  const eventHandlers = EditorView.domEventHandlers({
    mousemove(event, view) {
      // Only show clickable when Ctrl/Cmd is held
      const isModifierKey = event.ctrlKey || event.metaKey;

      // Get position under cursor
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });

      if (pos === null) {
        // Clear hover if not over editor content
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        view.dispatch({ effects: setHoverSymbol.of(null) });
        if (isShowingPreview) {
          onHidePreview?.();
          isShowingPreview = false;
        }
        return false;
      }

      // Check if we're still on the same symbol
      const symbol = extractSymbolAtPosition(view, pos);
      const currentSymbol = view.state.field(hoverSymbolState);

      if (!symbol || !isModifierKey) {
        // Not over a symbol or modifier key not held
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        if (currentSymbol) {
          view.dispatch({ effects: setHoverSymbol.of(null) });
        }
        if (isShowingPreview) {
          onHidePreview?.();
          isShowingPreview = false;
        }
        return false;
      }

      // Check if same symbol
      if (currentSymbol && currentSymbol.from === symbol.from && currentSymbol.to === symbol.to) {
        // Same symbol, keep everything as is
        return false;
      }

      // New symbol - update decoration immediately (only when modifier key is held)
      view.dispatch({ effects: setHoverSymbol.of(symbol) });

      // Hide previous preview
      if (isShowingPreview) {
        onHidePreview?.();
        isShowingPreview = false;
      }

      // Clear previous timer
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }

      // Start new timer to show preview
      hoverTimer = setTimeout(async () => {
        if (!onShowPreview) return;

        const result = await onDefinitionRequest(symbol, view);

        if (result?.found && result.definition) {
          const coords = view.coordsAtPos(symbol.from);
          if (coords) {
            // Show popup above the symbol
            onShowPreview(result, { x: coords.left, y: coords.top - 10 });
            isShowingPreview = true;
          }
        }
      }, hoverDelay);

      return false;
    },

    mouseleave(_event, view) {
      // Clear everything when mouse leaves editor
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      view.dispatch({ effects: setHoverSymbol.of(null) });
      if (isShowingPreview) {
        onHidePreview?.();
        isShowingPreview = false;
      }
      return false;
    },

    mousedown(event, view) {
      // Handle Ctrl/Cmd + Click - navigate directly
      const isModifierClick = event.ctrlKey || event.metaKey;

      if (!isModifierClick) return false;

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const symbol = extractSymbolAtPosition(view, pos);
      if (!symbol) return false;

      // Prevent default click behavior
      event.preventDefault();
      event.stopPropagation();

      // Hide preview if showing
      if (isShowingPreview) {
        onHidePreview?.();
        isShowingPreview = false;
      }

      // Request definition and navigate
      (async () => {
        const result = await onDefinitionRequest(symbol, view);

        if (result?.found && result.definition) {
          onNavigate(result);
        }
      })();

      return true;
    },
  });

  // CSS styles for the extension
  const theme = EditorView.baseTheme({
    '.cm-goto-definition-link': {
      textDecoration: 'underline',
      textDecorationStyle: 'dotted',
      textDecorationColor: 'var(--color-primary, #3b82f6)',
      cursor: 'pointer',
    },
  });

  return [
    hoverSymbolState,
    decorationPlugin,
    eventHandlers,
    theme,
  ];
}

/**
 * Check if a position is within a string or comment
 * (to avoid triggering on non-code text)
 */
export function isInStringOrComment(view: EditorView, pos: number): boolean {
  const tree = syntaxTree(view.state);
  const node = tree.resolveInner(pos, 1);

  const name = node.name.toLowerCase();
  return (
    name.includes('string') ||
    name.includes('comment') ||
    name.includes('template') ||
    name.includes('regex')
  );
}
