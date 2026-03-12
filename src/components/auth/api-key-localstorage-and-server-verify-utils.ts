'use client';

// Storage key for persisted API key
export const API_KEY_STORAGE_KEY = 'claude-kanban:api-key';

// Event name for triggering API key dialog from fetch interceptor
export const API_KEY_REQUIRED_EVENT = 'claude-kanban:api-key-required';

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
export async function checkAuthRequired(): Promise<boolean> {
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
export async function verifyApiKey(apiKey: string): Promise<boolean> {
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

/**
 * Dispatch event to trigger API key dialog
 */
export function dispatchApiKeyRequired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(API_KEY_REQUIRED_EVENT));
  }
}

/**
 * Helper to convert Headers to plain object
 */
export function headersToObject(headers: HeadersInit): Record<string, string> {
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  return headers as Record<string, string>;
}
