'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AgentProviderSetupForm } from '@/components/auth/agent-provider-dialog';
import { ApiAccessKeySetupForm } from '@/components/access-anywhere/api-access-key-setup-modal';
import { useTunnelStore } from '@/stores/tunnel-store';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Bot, Shield, Globe } from 'lucide-react';

type SectionId = 'agent-provider' | 'api-access-key' | 'remote-access';

interface SectionStatus {
  agentProvider: boolean;
  apiAccessKey: boolean;
  remoteAccess: boolean;
}

interface UnifiedSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: Partial<SectionStatus>;
}

export function UnifiedSetupWizard({ open, onOpenChange, initialStatus }: UnifiedSetupWizardProps) {
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null);
  const [status, setStatus] = useState<SectionStatus>({
    agentProvider: initialStatus?.agentProvider ?? false,
    apiAccessKey: initialStatus?.apiAccessKey ?? false,
    remoteAccess: initialStatus?.remoteAccess ?? false,
  });
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const hasAutoExpanded = useRef(false);

  const { setWizardOpen } = useTunnelStore();

  // Update status when initialStatus changes
  useEffect(() => {
    if (initialStatus) {
      setStatus(prev => ({
        agentProvider: initialStatus.agentProvider ?? prev.agentProvider,
        apiAccessKey: initialStatus.apiAccessKey ?? prev.apiAccessKey,
        remoteAccess: initialStatus.remoteAccess ?? prev.remoteAccess,
      }));
    }
  }, [initialStatus]);

  // Auto-expand first unconfigured section when opening (agent provider always starts collapsed).
  useEffect(() => {
    if (!open) {
      hasAutoExpanded.current = false;
      return;
    }
    if (hasAutoExpanded.current) return;

    const ak = initialStatus?.apiAccessKey ?? false;
    const ra = initialStatus?.remoteAccess ?? false;

    if (!ak) {
      setExpandedSection('api-access-key');
    } else if (!ra) {
      setExpandedSection('remote-access');
    } else {
      setExpandedSection(null);
    }
    hasAutoExpanded.current = true;
  }, [open, initialStatus?.apiAccessKey, initialStatus?.remoteAccess]);

  const toggleSection = (section: SectionId) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const handleClose = () => {
    if (doNotShowAgain) {
      localStorage.setItem('setup_wizard_dismissed', 'true');
    }
    onOpenChange(false);
  };

  const handleAgentProviderComplete = () => {
    setStatus(prev => ({ ...prev, agentProvider: true }));
    // Move to next unconfigured section
    if (!status.apiAccessKey) {
      setExpandedSection('api-access-key');
    } else if (!status.remoteAccess) {
      setExpandedSection('remote-access');
    } else {
      setExpandedSection(null);
    }
  };

  const handleApiAccessKeySuccess = () => {
    setStatus(prev => ({ ...prev, apiAccessKey: true }));
    // Move to next unconfigured section
    if (!status.remoteAccess) {
      setExpandedSection('remote-access');
    } else {
      setExpandedSection(null);
    }
  };

  const handleConfigureRemoteAccess = () => {
    // Close this wizard and open the Access Anywhere wizard
    onOpenChange(false);
    setWizardOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] z-[9999] max-h-[80vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>Set Up Your Workspace</DialogTitle>
          <DialogDescription>
            Configure the essential settings for your workspace. You can always change these later in Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-2 overflow-y-auto flex-1 min-h-0">
          {/* Section 1: Agent Provider */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('agent-provider')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-1.5 rounded-md',
                  status.agentProvider ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-primary/10 text-primary'
                )}>
                  {status.agentProvider ? <Check className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div>
                  <span className="font-medium">Agent Provider</span>
                  <p className="text-xs text-muted-foreground">
                    {status.agentProvider ? 'Configured' : 'Configure how to authenticate with Claude API'}
                  </p>
                </div>
              </div>
              <ChevronDown className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                expandedSection === 'agent-provider' && 'rotate-180'
              )} />
            </button>
            {expandedSection === 'agent-provider' && (
              <div className="border-t px-4 pb-4">
                <AgentProviderSetupForm onComplete={handleAgentProviderComplete} />
              </div>
            )}
          </div>

          {/* Section 2: API Access Key */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('api-access-key')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-1.5 rounded-md',
                  status.apiAccessKey ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-primary/10 text-primary'
                )}>
                  {status.apiAccessKey ? <Check className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                </div>
                <div>
                  <span className="font-medium">API Access Key</span>
                  <p className="text-xs text-muted-foreground">
                    {status.apiAccessKey ? 'Configured' : 'Set up authentication for remote access'}
                  </p>
                </div>
              </div>
              <ChevronDown className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                expandedSection === 'api-access-key' && 'rotate-180'
              )} />
            </button>
            {expandedSection === 'api-access-key' && (
              <div className="border-t px-4 py-4">
                <ApiAccessKeySetupForm onSuccess={handleApiAccessKeySuccess} />
              </div>
            )}
          </div>

          {/* Section 3: Remote Access */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('remote-access')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-1.5 rounded-md',
                  status.remoteAccess ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-primary/10 text-primary'
                )}>
                  {status.remoteAccess ? <Check className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                </div>
                <div>
                  <span className="font-medium">Remote Access</span>
                  <p className="text-xs text-muted-foreground">
                    {status.remoteAccess ? 'Configured' : 'Access your workspace from anywhere'}
                  </p>
                </div>
              </div>
              <ChevronDown className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                expandedSection === 'remote-access' && 'rotate-180'
              )} />
            </button>
            {expandedSection === 'remote-access' && (
              <div className="border-t px-4 py-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Set up a tunnel to access your workspace remotely from any device. Choose between ctunnel (quick setup) or Cloudflare (use your own domain).
                  </p>
                  <Button onClick={handleConfigureRemoteAccess}>
                    Configure Remote Access
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 pt-4 border-t shrink-0">
          <div className="flex items-center gap-2">
            <Checkbox
              id="doNotShowAgain"
              checked={doNotShowAgain}
              onCheckedChange={(checked) => setDoNotShowAgain(checked === true)}
            />
            <Label htmlFor="doNotShowAgain" className="text-sm cursor-pointer text-muted-foreground">
              Do not show this again
            </Label>
          </div>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
