'use client';

// Custom hook encapsulating ctunnel subdomain registration state and async actions

import { useEffect, useState } from 'react';
import { useTunnelStore } from '@/stores/tunnel-store';

type RegistrationStep = 'input' | 'confirm' | 'connecting' | 'connected' | 'error';

interface UseCtunnelRegistrationStateOptions {
  tFailedToStartTunnel: string;
  tSubdomainRequired: string;
  tSubdomainNotAvailable: string;
  tFailedToRegisterSubdomain: string;
  tConfirmationCodeIsRequired: string;
  tFailedToConfirmSubdomain: string;
}

export function useCtunnelRegistrationState({
  tFailedToStartTunnel,
  tSubdomainRequired,
  tSubdomainNotAvailable,
  tFailedToRegisterSubdomain,
  tConfirmationCodeIsRequired,
  tFailedToConfirmSubdomain,
}: UseCtunnelRegistrationStateOptions) {
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

  const canProceed = availability?.available || availability?.reason === 'registered';

  // Debounce inputs
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSubdomain(subdomain), 500);
    return () => clearTimeout(t);
  }, [subdomain]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedEmail(email), 500);
    return () => clearTimeout(t);
  }, [email]);

  // Auto-check availability
  useEffect(() => {
    if (!debouncedSubdomain || !debouncedEmail || debouncedSubdomain.length < 4) {
      setAvailability(null);
      return;
    }
    setChecking(true);
    fetch(`/api/subdomains/check?subdomain=${encodeURIComponent(debouncedSubdomain)}&email=${encodeURIComponent(debouncedEmail)}`)
      .then(r => r.json())
      .then(data => setAvailability(data))
      .catch(() => setAvailability(null))
      .finally(() => setChecking(false));
  }, [debouncedSubdomain, debouncedEmail]);

  // Sync tunnel status
  useEffect(() => {
    if (status === 'connected') {
      setStep('connected');
    } else if (status === 'error' && step === 'connecting') {
      setStep('error');
      setErrorMessage(error || tFailedToStartTunnel);
    }
  }, [status, error]);

  const registerSubdomain = async () => {
    setRegistering(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/subdomains/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subdomain }),
      });
      const data = await res.json();
      if (data.success) { setStep('confirm'); }
      else { setErrorMessage(data.message || tFailedToRegisterSubdomain); }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : tFailedToRegisterSubdomain);
    } finally {
      setRegistering(false);
    }
  };

  const handleContinue = async () => {
    if (!subdomain || !email) { setErrorMessage(tSubdomainRequired); return; }
    if (!availability?.available && availability?.reason !== 'registered') {
      setErrorMessage(tSubdomainNotAvailable);
      return;
    }
    await registerSubdomain();
  };

  const handleVerify = async () => {
    if (!confirmationCode) { setErrorMessage(tConfirmationCodeIsRequired); return; }
    setVerifying(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/subdomains/confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subdomain, confirmation_code: confirmationCode }),
      });
      const data = await res.json();
      if (data.success) { setStep('connecting'); await startTunnel(subdomain); }
      else { setErrorMessage(data.message || tFailedToConfirmSubdomain); }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : tFailedToConfirmSubdomain);
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyUrl = () => {
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFinish = () => {
    useTunnelStore.getState().completeOnboarding();
    setWizardOpen(false);
  };

  const handleRetry = () => { setStep('input'); setErrorMessage(''); setAvailability(null); };

  return {
    step, setStep,
    subdomain, setSubdomain,
    email, setEmail,
    confirmationCode, setConfirmationCode,
    checking, registering, verifying, copied,
    availability, errorMessage, canProceed: !!canProceed,
    url,
    handleContinue, handleVerify, handleCopyUrl, handleFinish, handleRetry,
    setWizardStep,
  };
}
