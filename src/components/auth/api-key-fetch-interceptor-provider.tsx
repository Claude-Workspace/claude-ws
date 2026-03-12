'use client';

import { useState, useEffect } from 'react';
import { ApiKeyDialog } from '@/components/auth/api-key-dialog';
import {
  getStoredApiKey,
  clearStoredApiKey,
  checkAuthRequired,
  verifyApiKey,
  dispatchApiKeyRequired,
  headersToObject,
  API_KEY_REQUIRED_EVENT,
} from '@/components/auth/api-key-localstorage-and-server-verify-utils';

// Extend global types for fetch patching
declare global {
  interface Window {
    fetch: typeof fetch & { _apiKeyPatched?: boolean };
  }
}

/**
 * Provider that patches global fetch to inject API key header and handle 401 responses.
 * Blocks children from rendering until authentication is confirmed.
 * Must wrap the app at a high level (client component only).
 */
export function ApiKeyFetchInterceptorProvider({ children }: { children: React.ReactNode }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Check auth on mount before rendering children
  useEffect(() => {
    const check = async () => {
      try {
        const needed = await checkAuthRequired();
        if (!needed) {
          setAuthChecked(true);
          return;
        }

        // Auth is required — check if we have a valid stored key
        const storedKey = getStoredApiKey();
        if (storedKey) {
          const valid = await verifyApiKey(storedKey);
          if (valid) {
            setAuthChecked(true);
            return;
          }
          clearStoredApiKey();
        }

        // No valid key — show dialog, don't render children
        setShowAuthDialog(true);
      } catch {
        // If check fails, allow through
        setAuthChecked(true);
      }
    };

    check();
  }, []);

  // Listen for API key required events dispatched by the fetch interceptor
  useEffect(() => {
    const handleApiKeyRequired = () => {
      setShowAuthDialog(true);
    };

    window.addEventListener(API_KEY_REQUIRED_EVENT, handleApiKeyRequired);
    return () => {
      window.removeEventListener(API_KEY_REQUIRED_EVENT, handleApiKeyRequired);
    };
  }, []);

  // Patch fetch synchronously on render to ensure it's available before child effects run
  if (typeof window !== 'undefined' && !window.fetch._apiKeyPatched) {
    const originalFetch = window.fetch;

    window.fetch = async (url, options) => {
      const apiKey = getStoredApiKey();
      const urlString = typeof url === 'string' ? url : url.toString();

      const existingHeaders = options?.headers ? headersToObject(options.headers) : {};
      const newHeaders: Record<string, string> = { ...existingHeaders };

      if (apiKey) {
        newHeaders['x-api-key'] = apiKey;
      }

      const newOptions: RequestInit = { ...options, headers: newHeaders };
      const response = await originalFetch(url, newOptions);

      // Trigger dialog on 401 from any API route except auth/verify
      const isApiRoute = urlString.includes('/api/');
      const isVerifyEndpoint = urlString.includes('/api/auth/verify');

      if (response.status === 401 && isApiRoute && !isVerifyEndpoint) {
        if (apiKey) clearStoredApiKey();
        dispatchApiKeyRequired();
      }

      return response;
    };

    window.fetch._apiKeyPatched = true;
  }

  const handleAuthSuccess = () => {
    setShowAuthDialog(false);
    window.location.reload();
  };

  // Block children while awaiting first auth confirmation
  if (showAuthDialog && !authChecked) {
    return (
      <ApiKeyDialog
        open={true}
        onOpenChange={() => {}}
        onSuccess={handleAuthSuccess}
      />
    );
  }

  return (
    <>
      {children}
      <ApiKeyDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
