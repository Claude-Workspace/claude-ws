'use client';

import { X, RotateCcw, Cpu, Settings, Trash2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useInteractiveCommandStore,
  getCommandTitle,
  getCommandDescription,
  InteractiveCommand,
} from '@/stores/interactive-command-store';
import { useEscapeClose } from '@/hooks/use-escape-close';
import { CheckpointList } from './checkpoint-list';
import { ModelSelector } from './model-selector';
import { ConfigEditor } from './config-editor';
import { ConfirmDialog } from './confirm-dialog';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// Get icon for command type
function getCommandIcon(command: InteractiveCommand) {
  switch (command.type) {
    case 'rewind':
      return <RotateCcw className="size-5" />;
    case 'model':
      return <Cpu className="size-5" />;
    case 'config':
      return <Settings className="size-5" />;
    case 'clear':
      return <Trash2 className="size-5" />;
    case 'compact':
      return <Minimize2 className="size-5" />;
    default:
      return null;
  }
}

export function InteractiveCommandOverlay() {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const { activeCommand, isOpen, isLoading, error, closeCommand } =
    useInteractiveCommandStore();

  // Close on Escape
  useEscapeClose(isOpen, closeCommand);

  if (!isOpen || !activeCommand) return null;

  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 z-50',
        'bg-background border rounded-lg shadow-lg',
        'animate-in slide-in-from-bottom-4 duration-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <div className="text-primary">{getCommandIcon(activeCommand)}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{getCommandTitle(activeCommand)}</h3>
          <p className="text-xs text-muted-foreground truncate">
            {getCommandDescription(activeCommand)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={closeCommand}
          className="shrink-0"
        >
          <X className="size-4 mr-1" />
          Cancel
          <kbd className="ml-2 px-1.5 py-0.5 text-[10px] bg-muted rounded">Esc</kbd>
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Content - render appropriate component based on command type */}
      <div className="max-h-80 overflow-y-auto">
        {activeCommand.type === 'rewind' && (
          <CheckpointList taskId={activeCommand.taskId} />
        )}
        {activeCommand.type === 'model' && (
          <ModelSelector currentModel={activeCommand.currentModel} />
        )}
        {activeCommand.type === 'config' && (
          <ConfigEditor section={activeCommand.section} />
        )}
        {activeCommand.type === 'clear' && (
          <ConfirmDialog
            title={t('clearConversation')}
            message={t('clearConversationConfirm')}
            confirmLabel={tCommon('clear')}
            confirmVariant="destructive"
            onConfirm={() => {
              // TODO: Implement clear
              closeCommand();
            }}
            onCancel={closeCommand}
          />
        )}
        {activeCommand.type === 'compact' && (
          <ConfirmDialog
            title={t('compactConversation')}
            message={t('compactConversationConfirm')}
            confirmLabel={t('compact')}
            onConfirm={() => {
              // TODO: Implement compact
              closeCommand();
            }}
            onCancel={closeCommand}
          />
        )}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}
