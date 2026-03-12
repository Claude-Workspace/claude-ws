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
import { Extension } from '@codemirror/state';
import { extractSymbolAtPosition } from './goto-definition-symbol-extractor';
import {
  setHoverSymbol,
  hoverSymbolState,
  linkDecoration,
} from './goto-definition-types-and-state';

export type {
  ExtractedSymbol,
  DefinitionInfo,
  GotoDefinitionConfig,
} from './goto-definition-types-and-state';

/**
 * Create the goto-definition extension
 */
export function gotoDefinitionExtension(config: import('./goto-definition-types-and-state').GotoDefinitionConfig): Extension {
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
        if (!symbol) return Decoration.none;
        return Decoration.set([linkDecoration.range(symbol.from, symbol.to)]);
      }
    },
    { decorations: (v) => v.decorations }
  );

  // Event handlers
  const eventHandlers = EditorView.domEventHandlers({
    mousemove(event, view) {
      const isModifierKey = event.ctrlKey || event.metaKey;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });

      if (pos === null) {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
        view.dispatch({ effects: setHoverSymbol.of(null) });
        if (isShowingPreview) { onHidePreview?.(); isShowingPreview = false; }
        return false;
      }

      const symbol = extractSymbolAtPosition(view, pos);
      const currentSymbol = view.state.field(hoverSymbolState);

      if (!symbol || !isModifierKey) {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
        if (currentSymbol) view.dispatch({ effects: setHoverSymbol.of(null) });
        if (isShowingPreview) { onHidePreview?.(); isShowingPreview = false; }
        return false;
      }

      if (currentSymbol && currentSymbol.from === symbol.from && currentSymbol.to === symbol.to) {
        return false;
      }

      view.dispatch({ effects: setHoverSymbol.of(symbol) });
      if (isShowingPreview) { onHidePreview?.(); isShowingPreview = false; }
      if (hoverTimer) clearTimeout(hoverTimer);

      hoverTimer = setTimeout(async () => {
        if (!onShowPreview) return;
        const result = await onDefinitionRequest(symbol, view);
        if (result?.found && result.definition) {
          const coords = view.coordsAtPos(symbol.from);
          if (coords) {
            onShowPreview(result, { x: coords.left, y: coords.top - 10 });
            isShowingPreview = true;
          }
        }
      }, hoverDelay);

      return false;
    },

    mouseleave(_event, view) {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      view.dispatch({ effects: setHoverSymbol.of(null) });
      if (isShowingPreview) { onHidePreview?.(); isShowingPreview = false; }
      return false;
    },

    mousedown(event, view) {
      const isModifierClick = event.ctrlKey || event.metaKey;
      if (!isModifierClick) return false;

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const symbol = extractSymbolAtPosition(view, pos);
      if (!symbol) return false;

      event.preventDefault();
      event.stopPropagation();

      if (isShowingPreview) { onHidePreview?.(); isShowingPreview = false; }

      (async () => {
        const result = await onDefinitionRequest(symbol, view);
        if (result?.found && result.definition) onNavigate(result);
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

  return [hoverSymbolState, decorationPlugin, eventHandlers, theme];
}

// Re-export utilities from extractor module for backward compatibility
export { isInStringOrComment } from './goto-definition-symbol-extractor';
