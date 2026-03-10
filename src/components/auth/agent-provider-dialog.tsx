'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AgentProviderSetupForm } from '@/components/auth/agent-provider-setup-form';

// Event name for triggering the dialog
export const AGENT_PROVIDER_CONFIG_EVENT = 'claude-kanban:agent-provider-config';

/**
 * Dispatch event to open the Agent Provider Config dialog
 */
export function dispatchAgentProviderConfig(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AGENT_PROVIDER_CONFIG_EVENT));
  }
}

/**
 * Check if an error message indicates an authentication/provider issue
 */
export function isProviderAuthError(errorMessage: string): boolean {
  const authErrorPatterns = [
    'Invalid API key',
    'Please run /login'
  ];

  return authErrorPatterns.some(pattern =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

// Re-export sub-components for direct usage
export { AgentProviderSetupForm } from '@/components/auth/agent-provider-setup-form';
export { AgentProviderOptionCard } from '@/components/auth/agent-provider-option-card';

interface AgentProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentProviderDialog({ open, onOpenChange }: AgentProviderDialogProps) {
  const t = useTranslations('agentProvider');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] z-[9999] max-h-[90vh] overflow-y-auto !grid !grid-rows-[auto_1fr]">
        <DialogHeader>
          <DialogTitle>{t('configureTitle')}</DialogTitle>
          <DialogDescription>
            {t('configureDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 -mx-6 px-6">
          {open && (
            <AgentProviderSetupForm
              onComplete={() => {
                onOpenChange(false);
                window.location.reload();
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
