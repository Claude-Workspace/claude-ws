'use client';

import { useTranslations } from 'next-intl';
import { useCtunnelRegistrationState } from './use-ctunnel-registration-state';
import { buildCtunnelLabels } from './wizard-step-ctunnel-labels-builder';
import {
  InputStep,
  ConfirmStep,
  ConnectedStep,
  ErrorStep,
  ConnectingStep,
} from './wizard-step-ctunnel-step-views';

export function WizardStepCtunnel() {
  const t = useTranslations('accessAnywhere');

  const {
    step, setStep,
    subdomain, setSubdomain,
    email, setEmail,
    confirmationCode, setConfirmationCode,
    checking, registering, verifying, copied,
    availability, errorMessage, canProceed,
    url,
    handleContinue, handleVerify, handleCopyUrl, handleFinish, handleRetry,
    setWizardStep,
  } = useCtunnelRegistrationState({
    tFailedToStartTunnel: t('failedToStartTunnel'),
    tSubdomainRequired: t('subdomainRequired'),
    tSubdomainNotAvailable: t('subdomainNotAvailable'),
    tFailedToRegisterSubdomain: t('failedToRegisterSubdomain'),
    tConfirmationCodeIsRequired: t('confirmationCodeIsRequired'),
    tFailedToConfirmSubdomain: t('failedToConfirmSubdomain'),
  });

  const labels = buildCtunnelLabels(t);

  const richDescription = t.rich('confirmationCodeSentDescription', {
    email,
    strong: (chunks) => <strong>{chunks}</strong>,
  });

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">{t('ctunnelTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('ctunnelSubtitle')}</p>
      </div>

      {step === 'input' && (
        <InputStep
          email={email}
          subdomain={subdomain}
          checking={checking}
          registering={registering}
          availability={availability}
          canProceed={canProceed}
          errorMessage={errorMessage}
          onEmailChange={setEmail}
          onSubdomainChange={setSubdomain}
          onContinue={handleContinue}
          onBack={() => setWizardStep(1)}
          labels={labels}
        />
      )}

      {step === 'confirm' && (
        <ConfirmStep
          email={email}
          confirmationCode={confirmationCode}
          verifying={verifying}
          errorMessage={errorMessage}
          onCodeChange={setConfirmationCode}
          onVerify={handleVerify}
          onBack={() => setStep('input')}
          richDescription={richDescription}
          labels={labels}
        />
      )}

      {step === 'connecting' && <ConnectingStep label={labels.connecting} />}

      {step === 'connected' && url && (
        <ConnectedStep
          url={url}
          copied={copied}
          onCopyUrl={handleCopyUrl}
          onBack={() => setWizardStep(1)}
          onFinish={handleFinish}
          labels={labels}
        />
      )}

      {step === 'error' && (
        <ErrorStep
          errorMessage={errorMessage}
          onBack={() => setWizardStep(1)}
          onRetry={handleRetry}
          labels={labels}
        />
      )}
    </div>
  );
}
