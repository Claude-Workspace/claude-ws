/**
 * File Sync Hook - Polls file system for changes and detects conflicts
 *
 * Monitors the currently open file every 10 seconds to detect external changes.
 * When changes are detected, triggers a callback with the remote content for
 * diff resolution.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('FileSyncHook');

export interface FileSyncState {
  /** Whether a sync conflict is detected */
  hasConflict: boolean;
  /** Remote (disk) content when conflict detected */
  remoteContent: string | null;
  /** Timestamp when remote content was last fetched */
  lastSyncedAt: number | null;
  /** Whether currently polling */
  isPolling: boolean;
}

export interface UseFileSyncOptions {
  /** File path to monitor (relative to basePath) */
  filePath: string | null;
  /** Base project path */
  basePath: string | null;
  /** Current content in the editor */
  currentContent: string;
  /** Original content when file was loaded */
  originalContent: string;
  /** Polling interval in milliseconds (default: 10000) */
  pollInterval?: number;
  /** Whether sync is enabled (default: true) */
  enabled?: boolean;
  /** Callback when file changes are detected AND local has unsaved changes (shows conflict modal) */
  onRemoteChange?: (remoteContent: string) => void;
  /** Callback when file changes are detected AND no local changes (silent auto-update) */
  onSilentUpdate?: (remoteContent: string) => void;
}

export function useFileSync({
  filePath,
  basePath,
  currentContent,
  originalContent,
  pollInterval = 10000,
  enabled = true,
  onRemoteChange,
  onSilentUpdate,
}: UseFileSyncOptions): FileSyncState & {
  /** Clear the current conflict state */
  clearConflict: () => void;
  /** Manually trigger a sync check */
  checkNow: () => Promise<void>;
  /** Accept remote content (updates original to remote) */
  acceptRemote: () => void;
  /** Keep local content (dismisses conflict) */
  keepLocal: () => void;
} {
  const [state, setState] = useState<FileSyncState>({
    hasConflict: false,
    remoteContent: null,
    lastSyncedAt: null,
    isPolling: false,
  });

  // Refs to access latest values in interval callback
  const currentContentRef = useRef(currentContent);
  const originalContentRef = useRef(originalContent);
  const lastKnownRemoteRef = useRef<string | null>(null);

  useEffect(() => {
    currentContentRef.current = currentContent;
  }, [currentContent]);

  useEffect(() => {
    originalContentRef.current = originalContent;
    // When original content changes (file reloaded), update last known remote
    lastKnownRemoteRef.current = originalContent;
  }, [originalContent]);

  // Fetch remote content from disk
  const fetchRemoteContent = useCallback(async (): Promise<string | null> => {
    if (!filePath || !basePath) return null;

    try {
      const res = await fetch(
        `/api/files/content?basePath=${encodeURIComponent(basePath)}&path=${encodeURIComponent(filePath)}`
      );

      if (!res.ok) return null;

      const data = await res.json();
      if (data.isBinary || data.content === null) return null;

      return data.content;
    } catch (error) {
      log.error({ error, filePath }, 'Error fetching remote content');
      return null;
    }
  }, [filePath, basePath]);

  // Check for remote changes
  const checkNow = useCallback(async () => {
    if (!filePath || !basePath || !enabled) return;

    setState(prev => ({ ...prev, isPolling: true }));

    try {
      const remoteContent = await fetchRemoteContent();

      if (remoteContent === null) {
        setState(prev => ({ ...prev, isPolling: false }));
        return;
      }

      const now = Date.now();

      // Compare remote content with last known remote
      // Only trigger conflict if:
      // 1. Remote has changed since last sync (not just different from original)
      // 2. Local has also been modified (has unsaved changes)
      const lastKnownRemote = lastKnownRemoteRef.current ?? originalContentRef.current;
      const remoteHasChanged = remoteContent !== lastKnownRemote;
      const localHasChanged = currentContentRef.current !== originalContentRef.current;

      if (remoteHasChanged) {
        // Update last known remote
        lastKnownRemoteRef.current = remoteContent;

        if (localHasChanged) {
          // Conflict: both local and remote changed - show diff resolver
          log.debug({ filePath }, 'Conflict detected - remote and local both changed');
          setState({
            hasConflict: true,
            remoteContent,
            lastSyncedAt: now,
            isPolling: false,
          });
          onRemoteChange?.(remoteContent);
        } else {
          // No local changes - silently update the editor content
          log.debug({ filePath }, 'Remote changed, no local changes - auto-updating');
          setState({
            hasConflict: false,
            remoteContent: null,
            lastSyncedAt: now,
            isPolling: false,
          });
          // Call silent update callback instead of showing conflict
          onSilentUpdate?.(remoteContent);
        }
      } else {
        // No remote changes
        setState(prev => ({
          ...prev,
          lastSyncedAt: now,
          isPolling: false,
        }));
      }
    } catch (error) {
      log.error({ error, filePath }, 'Check failed');
      setState(prev => ({ ...prev, isPolling: false }));
    }
  }, [filePath, basePath, enabled, fetchRemoteContent, onRemoteChange, onSilentUpdate]);

  // Clear conflict state
  const clearConflict = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasConflict: false,
      remoteContent: null,
    }));
  }, []);

  // Accept remote content
  const acceptRemote = useCallback(() => {
    if (state.remoteContent !== null) {
      lastKnownRemoteRef.current = state.remoteContent;
    }
    clearConflict();
  }, [state.remoteContent, clearConflict]);

  // Keep local content (dismiss conflict)
  const keepLocal = useCallback(() => {
    // Update last known remote to current content to avoid re-triggering
    lastKnownRemoteRef.current = currentContentRef.current;
    clearConflict();
  }, [clearConflict]);

  // Reset state when file changes
  useEffect(() => {
    setState({
      hasConflict: false,
      remoteContent: null,
      lastSyncedAt: null,
      isPolling: false,
    });
    lastKnownRemoteRef.current = null;
  }, [filePath]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !filePath || !basePath) return;

    // Initial check after a short delay (to let the file load first)
    const initialTimer = setTimeout(checkNow, 2000);

    // Regular polling
    const intervalId = setInterval(checkNow, pollInterval);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, [enabled, filePath, basePath, pollInterval, checkNow]);

  return {
    ...state,
    clearConflict,
    checkNow,
    acceptRemote,
    keepLocal,
  };
}
