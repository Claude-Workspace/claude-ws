// CodeMirror decoration builder for inline-edit diff preview
// Produces red-strikethrough (removed) and green-inserted (added) line decorations

import { Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { DiffResult, DiffLine } from '@/lib/diff-generator';
import type { InlineEditDiffState } from './inline-edit-types';

/**
 * Widget that renders added lines (green) in the diff as DOM nodes after the target line
 */
export class AddedLinesWidget extends WidgetType {
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

      const lineNumSpan = document.createElement('span');
      lineNumSpan.className = 'cm-inline-edit-line-number';
      lineNumSpan.textContent = String(lineNum++);

      const prefix = document.createElement('span');
      prefix.className = 'cm-inline-edit-prefix';
      prefix.textContent = '+';

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
 * Build CodeMirror decorations for a diff preview — git-style red/green lines.
 * Removed lines get a mark decoration (strikethrough highlight).
 * Added lines are injected as block widgets after their target line.
 */
export function buildDiffDecorations(
  doc: { line: (n: number) => { from: number; to: number } },
  diffState: InlineEditDiffState
): DecorationSet {
  const { selection, diff } = diffState;
  const builder = new RangeSetBuilder<Decoration>();

  console.log('[InlineEdit] Building decorations for selection:', selection.startLine, '-', selection.endLine);
  console.log('[InlineEdit] Diff lines:', diff.lines.map(l => `${l.type}: ${l.content.substring(0, 30)}...`));

  const addedGroups: { afterLine: number; lines: DiffLine[]; startLineNum: number }[] = [];
  let currentAddedGroup: DiffLine[] = [];
  let lastRemovedOrUnchangedLine = selection.startLine - 1;
  let originalLineNum = selection.startLine;
  let newLineNum = selection.startLine;

  for (const diffLine of diff.lines) {
    if (diffLine.type === 'removed') {
      if (currentAddedGroup.length > 0) {
        addedGroups.push({
          afterLine: lastRemovedOrUnchangedLine,
          lines: currentAddedGroup,
          startLineNum: newLineNum - currentAddedGroup.length,
        });
        currentAddedGroup = [];
      }

      if (originalLineNum <= selection.endLine) {
        const line = doc.line(originalLineNum);
        console.log('[InlineEdit] Adding removed decoration at line', originalLineNum, 'from', line.from, 'to', line.to);
        builder.add(line.from, line.to, Decoration.mark({ class: 'cm-inline-edit-removed-mark' }));
        lastRemovedOrUnchangedLine = originalLineNum;
        originalLineNum++;
      }
    } else if (diffLine.type === 'added') {
      currentAddedGroup.push(diffLine);
      newLineNum++;
    } else {
      // unchanged
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

  if (currentAddedGroup.length > 0) {
    addedGroups.push({
      afterLine: lastRemovedOrUnchangedLine,
      lines: currentAddedGroup,
      startLineNum: newLineNum - currentAddedGroup.length,
    });
  }

  let decorations = builder.finish();

  for (const group of addedGroups) {
    const line = doc.line(Math.max(selection.startLine, Math.min(group.afterLine, selection.endLine)));
    const widget = Decoration.widget({
      widget: new AddedLinesWidget(group.lines, group.startLineNum),
      block: true,
      side: 1,
    });
    decorations = decorations.update({ add: [widget.range(line.to)] });
  }

  return decorations;
}
