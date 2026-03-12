// Utilities for extracting symbols from CodeMirror editor positions

import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

/**
 * Symbol info extracted from editor at a cursor/click position
 */
export interface ExtractedSymbol {
  text: string;
  from: number;
  to: number;
  line: number;
  column: number;
}

/**
 * Extract symbol at position from editor using syntax tree with regex fallback
 */
export function extractSymbolAtPosition(view: EditorView, pos: number): ExtractedSymbol | null {
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
