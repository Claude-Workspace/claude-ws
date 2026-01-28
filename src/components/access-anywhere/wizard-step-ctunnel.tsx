'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTunnelStore } from '@/stores/tunnel-store';
import { TunnelStatusIndicator } from './tunnel-status-indicator';
import { ExternalLink, Loader2, Check, AlertCircle } from 'lucide-react';

type RegistrationStep = 'input' | 'confirm' | 'connecting' | 'connected' | 'error';

export function WizardStepCtunnel() {
  const t = useTranslations('accessAnywhere');
  const { status, url, error, startTunnel, setWizardStep, setWizardOpen } = useTunnelStore();
  const [step, setStep] = useState<RegistrationStep>('input');
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [debouncedSubdomain, setDebouncedSubdomain] = useState('');
  const [debouncedEmail, setDebouncedEmail] = useState('');

  // Check if user can proceed (available or already registered to this email)
  const canProceed = availability?.available || availability?.reason === 'registered';

  // Debounce inputs to check availability
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubdomain(subdomain);
    }, 500);
    return () => clearTimeout(timer);
  }, [subdomain]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmail(email);
    }, 500);
    return () => clearTimeout(timer);
  }, [email]);

  // Check availability when debounced inputs change
  useEffect(() => {
    const checkAvailability = async () => {
      if (!debouncedSubdomain || !debouncedEmail) {
        setAvailability(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/subdomains/check?subdomain=${encodeURIComponent(debouncedSubdomain)}&email=${encodeURIComponent(debouncedEmail)}`
        );
        const data = await response.json();
        setAvailability(data);
      } catch (error) {
        console.error('Failed to check availability:', error);
        setAvailability(null);
      }
    };

    checkAvailability();
  }, [debouncedSubdomain, debouncedEmail]);

  const checkAvailability = async () => {
    if (!subdomain || !email) {
      setErrorMessage('Subdomain and email are required');
      return;
    }

    // If not available but reason is "registered", it means this subdomain belongs to this email
    // User can proceed to confirmation step (or directly connect if already verified)
    if (!availability?.available) {
      if (availability?.reason === 'registered') {
        // Subdomain already registered to this email, proceed to confirmation or direct connect
        await registerSubdomain();
      } else {
        setErrorMessage('Subdomain is not available');
      }
      return;
    }

    await registerSubdomain();
  };

  const registerSubdomain = async () => {
    setRegistering(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/subdomains/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subdomain }),
      });
      const data = await response.json();

      if (data.success) {
        setStep('confirm');
      } else {
        setErrorMessage(data.message || 'Failed to register subdomain');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to register subdomain');
    } finally {
      setRegistering(false);
    }
  };

  const confirmSubdomain = async () => {
    if (!confirmationCode) {
      setErrorMessage('Confirmation code is required');
      return;
    }

    setVerifying(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/subdomains/confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subdomain, confirmation_code: confirmationCode }),
      });
      const data = await response.json();

      if (data.success) {
        setStep('connecting');
        await startTunnel(subdomain);
      } else {
        setErrorMessage(data.message || 'Failed to confirm subdomain');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to confirm subdomain');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (status === 'connected') {
      setStep('connected');
    } else if (status === 'error' && step === 'connecting') {
      setStep('error');
      setErrorMessage(error || 'Failed to start tunnel');
    }
  }, [status, error]);

  const handleCopyUrl = () => {
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRetry = () => {
    setStep('input');
    setErrorMessage('');
    setAvailability(null);
  };

  const handleFinish = () => {
    const { completeOnboarding } = useTunnelStore.getState();
    completeOnboarding();
    setWizardOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">{t('ctunnelTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('ctunnelSubtitle')}</p>
      </div>

      {step === 'input' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={checking || registering}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subdomain">{t('subdomain')}</Label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Input
                  id="subdomain"
                  placeholder={t('subdomainPlaceholder')}
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  disabled={checking || registering}
                  className={`font-mono pr-10 ${availability ? (canProceed ? 'border-green-500' : 'border-destructive') : ''}`}
                />
                {availability && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {canProceed ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              <span className="text-sm text-muted-foreground">.claude.ws</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('subdomainHint')}
            </p>

            {/* Availability status message */}
            {availability && subdomain && email && (
              <div className={`text-xs flex items-center gap-1 ${canProceed ? 'text-green-600' : 'text-destructive'}`}>
                {canProceed ? (
                  availability.reason === 'registered' ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>{t('subdomainBelongsToYou')}</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      <span>{t('subdomainAvailable')}</span>
                    </>
                  )
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    <span>{availability.reason || t('notAvailable')}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {errorMessage && step === 'input' && !canProceed && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setWizardStep(1)} disabled={registering}>
              {t('back')}
            </Button>
            <Button
              onClick={checkAvailability}
              disabled={checking || registering || !subdomain || !email || !canProceed}
            >
              {checking ? t('checking') : registering ? t('registering') : t('continue')}
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">{t('confirmationCodeSent')}</p>
            <p className="text-muted-foreground">
              {t.rich('confirmationCodeSentDescription', { email, strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">{t('confirmationCode')}</Label>
            <Input
              id="code"
              placeholder={t('confirmationCodePlaceholder')}
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              disabled={verifying}
              maxLength={6}
              className="font-mono text-center text-lg tracking-widest"
            />
          </div>

          {errorMessage && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep('input')} disabled={verifying}>
              {t('back')}
            </Button>
            <Button onClick={confirmSubdomain} disabled={verifying || !confirmationCode}>
              {verifying ? t('verifying') : t('verifyAndStart')}
            </Button>
          </div>
        </div>
      )}

      {step === 'connecting' && (
        <div className="flex flex-col items-center space-y-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('connecting')}</p>
        </div>
      )}

      {step === 'connected' && url && (
        <div className="space-y-4">
          <div className="bg-green-500/10 text-green-600 rounded-lg p-4 flex items-start gap-2">
            <Check className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{t('subdomainRegistered')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('workspaceAccessibleAt')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">{t('yourPublicUrl')}</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                value={url}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyUrl}
                title={t('copyUrl')}
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <ExternalLink className="h-4 w-4" />}
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-green-600">{t('urlCopied')}</p>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">{t('testYourUrl')}</p>
            <p className="text-muted-foreground">
              {t('testYourUrlDescription')}
            </p>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setWizardStep(1)}>
              {t('back')}
            </Button>
            <Button onClick={handleFinish}>
              {t('finish')}
            </Button>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-destructive/10 text-destructive rounded-lg p-4">
            <p className="font-medium mb-1">{t('error')}</p>
            <p className="text-sm">{errorMessage}</p>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setWizardStep(1)}>
              {t('back')}
            </Button>
            <Button onClick={handleRetry}>
              {t('tryAgain')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
