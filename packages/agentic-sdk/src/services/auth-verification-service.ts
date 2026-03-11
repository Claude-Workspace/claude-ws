/**
 * Auth verification service - checks if API auth is enabled and verifies keys
 * Uses timing-safe comparison to prevent timing attacks
 */
import { safeCompare } from '../lib/timing-safe-compare';

export function createAuthVerificationService(apiAccessKey?: string) {
  return {
    /** Check if API authentication is enabled */
    isAuthEnabled(): boolean {
      return Boolean(apiAccessKey && apiAccessKey.length > 0);
    },

    /** Verify an API key value (timing-safe) */
    verifyKeyValue(key: string): boolean {
      if (!apiAccessKey) return false;
      return safeCompare(key, apiAccessKey);
    },
  };
}
