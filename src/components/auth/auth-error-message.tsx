'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgentProviderDialog, isProviderAuthError } from './agent-provider-dialog';

interface AuthErrorMessageProps {
  message: string;
  className?: string;
}

/**
 * Component that displays an auth error message with a "Config Agent Provider" button
 * Shows when authentication/provider errors are detected
 */
export function AuthErrorMessage({ message, className }: AuthErrorMessageProps) {
  const t = useTranslations('auth');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Only show if it's an auth-related error
  if (!isProviderAuthError(message)) {
    return null;
  }

  return (
    <>
      <div className={className}>
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div className="text-sm text-destructive font-medium">
              {t('authenticationError')}
            </div>
            <div className="text-sm text-muted-foreground">
              {message}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              {t('configAgentProvider')}
            </Button>
          </div>
        </div>
      </div>

      <AgentProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

/**
 * Inline button for showing in tool results or smaller contexts
 */
export function ConfigProviderButton({ className }: { className?: string }) {
  const t = useTranslations('auth');
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className={className}
      >
        <Settings2 className="h-4 w-4 mr-2" />
        {t('configAgentProvider')}
      </Button>

      <AgentProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
