'use client';

import { useState, useEffect } from 'react';
import {
  AgentProviderDialog,
  AGENT_PROVIDER_CONFIG_EVENT,
} from '@/components/auth/agent-provider-dialog';

/**
 * Global provider that listens for agent provider config events
 * and shows the configuration dialog when needed.
 * Auto-shows dialog on mount if no provider is configured.
 */
export function AgentProviderConfigProvider({ children }: { children: React.ReactNode }) {
  const [showDialog, setShowDialog] = useState(false);
  const [hasCheckedProviders, setHasCheckedProviders] = useState(false);

  // Check if any provider is configured on mount
  useEffect(() => {
    if (hasCheckedProviders) return;

    const checkProviders = async () => {
      try {
        const res = await fetch('/api/settings/provider');
        if (!res.ok) return;

        const data = await res.json();
        const providers = data.providers;

        // Check if any provider is configured
        const hasAnyConfigured =
          providers?.custom?.configured ||
          providers?.settings?.configured ||
          providers?.console?.configured ||
          providers?.oauth?.configured;

        // Show dialog if no provider is configured
        if (!hasAnyConfigured) {
          setShowDialog(true);
        }
      } catch {
        // Ignore fetch errors - don't block app startup
      } finally {
        setHasCheckedProviders(true);
      }
    };

    checkProviders();
  }, [hasCheckedProviders]);

  // Listen for global events to open the dialog
  useEffect(() => {
    const handleConfigEvent = () => {
      setShowDialog(true);
    };

    window.addEventListener(AGENT_PROVIDER_CONFIG_EVENT, handleConfigEvent);
    return () => {
      window.removeEventListener(AGENT_PROVIDER_CONFIG_EVENT, handleConfigEvent);
    };
  }, []);

  return (
    <>
      {children}
      <AgentProviderDialog
        open={showDialog}
        onOpenChange={setShowDialog}
      />
    </>
  );
}
