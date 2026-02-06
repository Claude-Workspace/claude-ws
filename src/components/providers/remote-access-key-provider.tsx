'use client';

import { useState, useEffect } from 'react';
import { ApiAccessKeySetupModal } from '@/components/access-anywhere/api-access-key-setup-modal';

/**
 * Check if current hostname is localhost
 */
function isLocalhost(): boolean {
  if (typeof window === 'undefined') return true;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Provider that checks for API access key when accessing from remote URL.
 * Shows setup modal if accessing from non-localhost without API key configured.
 */
export function RemoteAccessKeyProvider({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isLocal, setIsLocal] = useState(true);

  useEffect(() => {
    // Set isLocal state on client side only
    setIsLocal(isLocalhost());

    const checkRemoteAccess = async () => {
      // Skip check on localhost
      if (isLocalhost()) {
        setChecked(true);
        return;
      }
      // Auto-complete onboarding for remote access users
      localStorage.setItem('onboarding_completed', 'true');

      // Check if auth is already required (API key already configured)
      try {
        const authRes = await fetch('/api/auth/verify');
        const authData = await authRes.json();

        // If authRequired is true, API key is already configured - no need to prompt
        if (authData.authRequired === true) {
          setChecked(true);
          return;
        }
      } catch {
        // If check fails, continue to next check
      }

      // Check if API access key is configured
      try {
        const res = await fetch('/api/settings/api-access-key');
        const data = await res.json();

        if (!data.configured) {
          setShowModal(true);
        }
      } catch {
        // If check fails, allow to continue
      }
      setChecked(true);
    };

    checkRemoteAccess();
  }, []);

  const handleSuccess = () => {
    setShowModal(false);
    // Reload to apply the new API key
    window.location.reload();
  };

  // Always render children to avoid hydration mismatch
  // Use a wrapper to conditionally hide content during check
  return (
    <>
      {(checked || isLocal) ? children : null}
      <ApiAccessKeySetupModal
        open={showModal}
        onOpenChange={setShowModal}
        onSuccess={handleSuccess}
      />
    </>
  );
}
