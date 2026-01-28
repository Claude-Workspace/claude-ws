'use client';

import { useState, useEffect } from 'react';
import { Key, AlertCircle, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Extend global types for fetch patching
declare global {
  interface Window {
    fetch: typeof fetch & { _apiKeyPatched?: boolean };
  }
}

const API_KEY_STORAGE_KEY = 'claude-kanban:api-key';

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Get stored API key from localStorage
 */
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Store API key in localStorage
 */
export function storeApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  } catch {
    // Silent fail if localStorage is not available
  }
}

/**
 * Clear stored API key from localStorage
 */
export function clearStoredApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Silent fail if localStorage is not available
  }
}

/**
 * Check if API key is required by the server
 */
async function checkAuthRequired(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/verify');
    const data = await res.json();
    return data.authRequired === true;
  } catch {
    // If check fails, assume auth is not required
    return false;
  }
}

/**
 * Verify API key with the server
 */
async function verifyApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

export function ApiKeyDialog({ open, onOpenChange, onSuccess }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setApiKey('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setLoading(true);
    try {
      const valid = await verifyApiKey(apiKey);
      if (valid) {
        storeApiKey(apiKey);
        setApiKey('');
        onOpenChange(false);
        onSuccess();
      } else {
        setError('Invalid API key');
      }
    } catch {
      setError('Failed to verify API key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] z-[9999]">
        <DialogHeader>
          <DialogTitle>API Key Required</DialogTitle>
          <DialogDescription>
            This server requires an API key for access. Enter your key to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* API Key Input */}
          <div className="space-y-2">
            <label htmlFor="api-key" className="text-sm font-medium">
              API Key
            </label>
            <div className="relative">
              <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="pl-8"
                disabled={loading}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your API key will be stored locally in your browser
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Success hint */}
          {!error && apiKey && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-muted-foreground" />
              Press Enter or click Submit to verify
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !apiKey}>
              {loading ? 'Verifying...' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to check if API auth is required and key is stored
 * Returns true if user needs to enter API key
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

/**
 * Helper to convert Headers to plain object
 */
function headersToObject(headers: HeadersInit): Record<string, string> {
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  return headers as Record<string, string>;
}

// Event name for triggering API key dialog from fetch interceptor
const API_KEY_REQUIRED_EVENT = 'claude-kanban:api-key-required';

/**
 * Dispatch event to trigger API key dialog
 */
function dispatchApiKeyRequired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(API_KEY_REQUIRED_EVENT));
  }
}

/**
 * Provider that patches global fetch to include API key and handle 401 responses
 * Must be a client component and wrap the app
 */
export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // Listen for API key required events from fetch interceptor
  useEffect(() => {
    const handleApiKeyRequired = () => {
      setShowAuthDialog(true);
    };

    window.addEventListener(API_KEY_REQUIRED_EVENT, handleApiKeyRequired);
    return () => {
      window.removeEventListener(API_KEY_REQUIRED_EVENT, handleApiKeyRequired);
    };
  }, []);

  // Patch fetch immediately on render (synchronously)
  // This ensures it's available before any useEffect in child components runs
  if (typeof window !== 'undefined' && !window.fetch._apiKeyPatched) {
    const originalFetch = window.fetch;

    window.fetch = async (url, options) => {
      const apiKey = getStoredApiKey();

      // Build new headers object with API key if available
      const existingHeaders = options?.headers
        ? headersToObject(options.headers)
        : {};

      const newHeaders: Record<string, string> = {
        ...existingHeaders,
      };

      // Add API key if stored
      if (apiKey) {
        newHeaders['x-api-key'] = apiKey;
      }

      // Create new options with merged headers
      const newOptions: RequestInit = {
        ...options,
        headers: newHeaders,
      };

      const response = await originalFetch(url, newOptions);

      // Check for 401 on API routes (except auth/verify endpoint)
      const urlString = typeof url === 'string' ? url : url.toString();
      const isApiRoute = urlString.includes('/api/');
      const isVerifyEndpoint = urlString.includes('/api/auth/verify');

      if (response.status === 401 && isApiRoute && !isVerifyEndpoint) {
        // Clear stored key if it's invalid
        if (apiKey) {
          clearStoredApiKey();
        }
        // Trigger API key dialog
        dispatchApiKeyRequired();
      }

      return response;
    };

    // Mark as patched to avoid double-patching
    window.fetch._apiKeyPatched = true;
  }

  const handleAuthSuccess = () => {
    setShowAuthDialog(false);

    // Reload page to reinitialize all components with authenticated state
    window.location.reload();
  };

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
