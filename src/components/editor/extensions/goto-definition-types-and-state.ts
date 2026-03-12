// Types, interfaces, and shared CodeMirror state for the goto-definition extension

import { EditorView, Decoration } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import type { ExtractedSymbol } from './goto-definition-symbol-extractor';

/**
 * Symbol info extracted from editor
 */
export type { ExtractedSymbol };

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
export const setHoverSymbol = StateEffect.define<ExtractedSymbol | null>();

// State field to track hovered symbol
export const hoverSymbolState = StateField.define<ExtractedSymbol | null>({
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
export const linkDecoration = Decoration.mark({
  class: 'cm-goto-definition-link',
});
