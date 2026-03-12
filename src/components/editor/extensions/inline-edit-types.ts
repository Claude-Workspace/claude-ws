// Shared types and interfaces for the inline-edit CodeMirror extension

import type { DiffResult } from '@/lib/diff-generator';

/**
 * Selection info extracted from editor when Ctrl/Cmd+I is pressed
 */
export interface InlineEditSelection {
  from: number;
  to: number;
  text: string;
  startLine: number;
  endLine: number;
}

/**
 * Diff state used for rendering the inline preview
 */
export interface InlineEditDiffState {
  selection: InlineEditSelection;
  originalCode: string;
  generatedCode: string;
  diff: DiffResult;
  status: 'preview';
}

/**
 * Configuration for the inline-edit extension
 */
export interface InlineEditConfig {
  /** Callback when Ctrl/Cmd+I is pressed with a selection */
  onEditRequest: (selection: InlineEditSelection) => void;
  /** Callback when accept (Enter) is pressed */
  onAccept: () => void;
  /** Callback when reject (Escape) is pressed */
  onReject: () => void;
  /** Whether the extension is enabled */
  enabled?: boolean;
}
