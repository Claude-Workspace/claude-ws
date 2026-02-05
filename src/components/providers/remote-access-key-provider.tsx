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

  useEffect(() => {
    const checkRemoteAccess = async () => {
      // Skip check on localhost
      if (isLocalhost()) {
        setChecked(true);
        return;
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

  // Don't render children until we've checked (prevents flash)
  if (!checked && !isLocalhost()) {
    return null;
  }

  return (
    <>
      {children}
      <ApiAccessKeySetupModal
        open={showModal}
        onOpenChange={setShowModal}
        onSuccess={handleSuccess}
      />
    </>
  );
}
