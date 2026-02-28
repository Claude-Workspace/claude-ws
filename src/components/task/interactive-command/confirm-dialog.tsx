'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tCommon = useTranslations('common');
  const resolvedConfirmLabel = confirmLabel ?? tCommon('confirm');
  const resolvedCancelLabel = cancelLabel ?? tCommon('cancel');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm]);

  return (
    <div className="p-6">
      <div className="flex gap-4">
        <div
          className={cn(
            'shrink-0 size-10 rounded-full flex items-center justify-center',
            confirmVariant === 'destructive'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary'
          )}
        >
          <AlertTriangle className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-6">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {resolvedCancelLabel}
        </Button>
        <Button
          variant={confirmVariant}
          size="sm"
          onClick={onConfirm}
        >
          {resolvedConfirmLabel}
          <kbd className="ml-2 px-1.5 py-0.5 text-[10px] bg-background/20 rounded">Enter</kbd>
        </Button>
      </div>
    </div>
  );
}
