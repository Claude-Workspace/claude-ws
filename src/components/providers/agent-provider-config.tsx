'use client';

import { useState, useEffect } from 'react';
import {
  AgentProviderDialog,
  AGENT_PROVIDER_CONFIG_EVENT,
} from '@/components/auth/agent-provider-dialog';

/**
 * Global provider that listens for agent provider config events
 * and shows the configuration dialog when needed
 */
export function AgentProviderConfigProvider({ children }: { children: React.ReactNode }) {
  const [showDialog, setShowDialog] = useState(false);

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
