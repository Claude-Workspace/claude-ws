'use client';

import { useState, useEffect } from 'react';
import {
  getStoredApiKey,
  clearStoredApiKey,
  checkAuthRequired,
  verifyApiKey,
} from '@/components/auth/api-key-localstorage-and-server-verify-utils';

/**
 * Hook to check if API auth is required and whether a valid key is stored.
 * Returns needsApiKey=true when the user must enter an API key.
 */
export function useApiKeyCheck(refreshTrigger = 0): {
  needsApiKey: boolean;
  checking: boolean;
} {
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      setChecking(true);
      try {
        const authRequired = await checkAuthRequired();
        if (!authRequired) {
          if (mounted) setNeedsApiKey(false);
          return;
        }

        const storedKey = getStoredApiKey();
        if (!storedKey) {
          if (mounted) setNeedsApiKey(true);
          return;
        }

        // Verify stored key is still valid
        const valid = await verifyApiKey(storedKey);
        if (!valid) {
          clearStoredApiKey();
          if (mounted) setNeedsApiKey(true);
          return;
        }

        if (mounted) setNeedsApiKey(false);
      } catch {
        if (mounted) setNeedsApiKey(false);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [refreshTrigger]);

  return { needsApiKey, checking };
}
