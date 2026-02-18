'use client';

import { Copy, ClipboardPaste, TextSelect, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
import { useTerminalStore } from '@/stores/terminal-store';

interface TerminalContextMenuProps {
  terminalId: string;
  children: React.ReactNode;
}

export function TerminalContextMenu({ terminalId, children }: TerminalContextMenuProps) {
  const copySelection = useTerminalStore((s) => s.copySelection);
  const pasteClipboard = useTerminalStore((s) => s.pasteClipboard);
  const selectAll = useTerminalStore((s) => s.selectAll);
  const clearTerminal = useTerminalStore((s) => s.clearTerminal);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => copySelection(terminalId)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => pasteClipboard(terminalId)}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Paste
          <ContextMenuShortcut>Ctrl+Shift+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => selectAll(terminalId)}>
          <TextSelect className="mr-2 h-4 w-4" />
          Select All
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => clearTerminal(terminalId)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Terminal
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
