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
import { useTranslations } from 'next-intl';

interface TerminalContextMenuProps {
  terminalId: string;
  children: React.ReactNode;
}

export function TerminalContextMenu({ terminalId, children }: TerminalContextMenuProps) {
  const tCommon = useTranslations('common');
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
          {tCommon('copy')}
          <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => pasteClipboard(terminalId)}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          {tCommon('paste')}
          <ContextMenuShortcut>Ctrl+Shift+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => selectAll(terminalId)}>
          <TextSelect className="mr-2 h-4 w-4" />
          {tCommon('selectAll')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => clearTerminal(terminalId)}>
          <Trash2 className="mr-2 h-4 w-4" />
          {tCommon('clearTerminal')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
