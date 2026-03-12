'use client';

import { AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslations } from 'next-intl';

type TranslationFn = ReturnType<typeof useTranslations>;

interface FileTabToolbarAttachToChatButtonProps {
  selection: { startLine: number; endLine: number } | null;
  selectedTask: { id: string } | null;
  handleAttachToChat: (createNew?: boolean) => void;
  t: TranslationFn;
}

/**
 * FileTabToolbarAttachToChatButton - The "@" button in the file tab toolbar that lets
 * users attach the current file or a line selection to an existing or new chat task.
 * Extracted from file-tab-toolbar.tsx to keep that file under 200 lines.
 */
export function FileTabToolbarAttachToChatButton({
  selection,
  selectedTask,
  handleAttachToChat,
  t,
}: FileTabToolbarAttachToChatButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title={
            selection
              ? t('addLinesToChat', { startLine: selection.startLine, endLine: selection.endLine })
              : t('addFileToChat')
          }
          className="relative"
        >
          <AtSign className="size-4" />
          {selection && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary text-[8px] text-primary-foreground items-center justify-center">
                {selection.endLine - selection.startLine + 1}
              </span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {selectedTask ? (
          <>
            <DropdownMenuItem onClick={() => handleAttachToChat(false)}>
              <span className="text-sm">
                {selection
                  ? `Add lines L${selection.startLine}-${selection.endLine} to current chat`
                  : 'Add file to current chat'}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAttachToChat(true)}>
              <span className="text-sm">Create new chat</span>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => handleAttachToChat(true)}>
            <span className="text-sm">
              {selection
                ? `Create chat with lines L${selection.startLine}-${selection.endLine}`
                : 'Create new chat'}
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
