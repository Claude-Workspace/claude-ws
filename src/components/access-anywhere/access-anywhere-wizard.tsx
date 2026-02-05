'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useTunnelStore } from '@/stores/tunnel-store';
import { WizardStepWelcome } from './wizard-step-welcome';
import { WizardStepMethod } from './wizard-step-method';
import { WizardStepCtunnel } from './wizard-step-ctunnel';
import { WizardStepCloudflare } from './wizard-step-cloudflare';
import { WizardStepSuccess } from './wizard-step-success';
import { TunnelSettingsDialog } from './tunnel-settings-dialog';
import { ApiAccessKeySetupModal } from './api-access-key-setup-modal';

export function AccessAnywhereWizard() {
  const { wizardOpen, setWizardOpen, wizardStep, selectedMethod, getTunnelConfig, onboardingCompleted } = useTunnelStore();
  const [hasConfig, setHasConfig] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(false);
  const [hasApiAccessKey, setHasApiAccessKey] = useState<boolean | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Check if API_ACCESS_KEY is configured
  useEffect(() => {
    const checkApiAccessKey = async () => {
      if (wizardOpen) {
        try {
          const res = await fetch('/api/settings/api-access-key');
          const data = await res.json();
          setHasApiAccessKey(data.configured);

          // Show modal if not configured
          if (!data.configured) {
            setShowApiKeyModal(true);
          }
        } catch {
          // If check fails, allow to continue (might be first run)
          setHasApiAccessKey(true);
        }
      }
    };
    checkApiAccessKey();
  }, [wizardOpen]);

  useEffect(() => {
    const checkConfig = async () => {
      if (wizardOpen && hasApiAccessKey) {
        setCheckingConfig(true);
        const config = await getTunnelConfig();
        setHasConfig(!!config);
        setCheckingConfig(false);
      }
    };
    checkConfig();
  }, [wizardOpen, wizardStep, onboardingCompleted, getTunnelConfig, hasApiAccessKey]);

  // Handle API key setup success
  const handleApiKeySuccess = () => {
    setShowApiKeyModal(false);
    setHasApiAccessKey(true);
  };

  // Handle API key modal cancel - close wizard
  const handleApiKeyModalClose = (open: boolean) => {
    if (!open) {
      setShowApiKeyModal(false);
      setWizardOpen(false);
    }
  };

  // Show API key setup modal if not configured
  if (wizardOpen && hasApiAccessKey === false) {
    return (
      <ApiAccessKeySetupModal
        open={showApiKeyModal}
        onOpenChange={handleApiKeyModalClose}
        onSuccess={handleApiKeySuccess}
      />
    );
  }

  // Show settings dialog if already configured
  if (hasConfig && wizardOpen && wizardStep === 0) {
    return <TunnelSettingsDialog />;
  }

  const renderStep = () => {
    switch (wizardStep) {
      case 0:
        return <WizardStepWelcome />;
      case 1:
        return <WizardStepMethod />;
      case 2:
        return selectedMethod === 'cloudflare' ? <WizardStepCloudflare /> : <WizardStepCtunnel />;
      case 3:
        return <WizardStepSuccess />;
      default:
        return <WizardStepWelcome />;
    }
  };

  const getDialogTitle = () => {
    switch (wizardStep) {
      case 0:
        return 'Access Your Workspace Anywhere';
      case 1:
        return 'Choose Your Method';
      case 2:
        return selectedMethod === 'cloudflare' ? 'Use your domain with Cloudflare' : 'Quick Setup with ctunnel';
      case 3:
        return 'You\'re All Set!';
      default:
        return 'Access Your Workspace Anywhere';
    }
  };

  if (checkingConfig) {
    return null; // Don't render while checking
  }

  return (
    <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
      <DialogContent className="sm:max-w-lg">
        <VisuallyHidden>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </VisuallyHidden>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
