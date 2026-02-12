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
  /** Last known remote file modification time */
  lastKnownMtime: number | null;
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
    lastKnownMtime: null,
  });

  // Refs to access latest values in interval callback
  const currentContentRef = useRef(currentContent);
  const originalContentRef = useRef(originalContent);
  const lastKnownRemoteRef = useRef<string | null>(null);
  const lastKnownMtimeRef = useRef<number | null>(null);
  const isCheckingRef = useRef(false); // Prevent duplicate concurrent checks

  useEffect(() => {
    currentContentRef.current = currentContent;
  }, [currentContent]);

  useEffect(() => {
    originalContentRef.current = originalContent;
    // When original content changes (file reloaded), update last known remote
    lastKnownRemoteRef.current = originalContent;
  }, [originalContent]);

  // Fetch remote metadata from disk (lightweight check - only mtime)
  const fetchRemoteMetadata = useCallback(async (): Promise<{ mtime: number | null } | null> => {
    if (!filePath || !basePath) return null;

    try {
      const res = await fetch(
        `/api/files/metadata?basePath=${encodeURIComponent(basePath)}&path=${encodeURIComponent(filePath)}`
      );

      if (!res.ok) return null;

      const data = await res.json();
      return { mtime: data.mtime ?? null };
    } catch (error) {
      log.error({ error, filePath }, 'Error fetching remote metadata');
      return null;
    }
  }, [filePath, basePath]);

  // Fetch remote content from disk
  const fetchRemoteContent = useCallback(async (): Promise<{ content: string | null; mtime: number | null }> => {
    if (!filePath || !basePath) return { content: null, mtime: null };

    try {
      const res = await fetch(
        `/api/files/content?basePath=${encodeURIComponent(basePath)}&path=${encodeURIComponent(filePath)}`
      );

      if (!res.ok) return { content: null, mtime: null };

      const data = await res.json();
      if (data.isBinary || data.content === null) return { content: null, mtime: data.mtime ?? null };

      return { content: data.content, mtime: data.mtime ?? null };
    } catch (error) {
      log.error({ error, filePath }, 'Error fetching remote content');
      return { content: null, mtime: null };
    }
  }, [filePath, basePath]);

  // Check for remote changes
  const checkNow = useCallback(async () => {
    if (!filePath || !basePath || !enabled) return;

    // Guard against concurrent checks
    if (isCheckingRef.current) {
      log.debug({ filePath }, 'Check already in progress, skipping');
      return;
    }

    isCheckingRef.current = true;
    setState(prev => ({ ...prev, isPolling: true }));

    try {
      // Step 1: Lightweight metadata check (only mtime)
      const metadata = await fetchRemoteMetadata();

      if (!metadata || metadata.mtime === null) {
        setState(prev => ({ ...prev, isPolling: false }));
        isCheckingRef.current = false;
        return;
      }

      const now = Date.now();

      // Step 2: Compare mtime with last known
      const lastMtime = lastKnownMtimeRef.current;

      // If mtime hasn't changed, no need to fetch content
      if (lastMtime && metadata.mtime === lastMtime) {
        setState(prev => ({ ...prev, isPolling: false }));
        isCheckingRef.current = false;
        return;
      }

      // Step 3: mtime changed - fetch full content
      const result = await fetchRemoteContent();

      if (result.content === null) {
        setState(prev => ({ ...prev, isPolling: false }));
        isCheckingRef.current = false;
        return;
      }

      const { content: remoteContent, mtime } = result;

      // Update last known mtime
      lastKnownMtimeRef.current = mtime ?? null;

      // Compare remote content with last known remote
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
            lastKnownMtime: mtime,
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
            lastKnownMtime: mtime,
          });
          onSilentUpdate?.(remoteContent);
        }
      } else {
        // No remote changes
        setState(prev => ({
          ...prev,
          lastSyncedAt: now,
          isPolling: false,
          lastKnownMtime: mtime,
        }));
      }
      isCheckingRef.current = false;
    } catch (error) {
      log.error({ error, filePath }, 'Check failed');
      setState(prev => ({ ...prev, isPolling: false }));
      isCheckingRef.current = false;
    }
  }, [filePath, basePath, enabled, fetchRemoteMetadata, fetchRemoteContent, onRemoteChange, onSilentUpdate]);

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
      lastKnownMtimeRef.current = state.lastKnownMtime;
    }
    clearConflict();
  }, [state.remoteContent, state.lastKnownMtime, clearConflict]);

  // Keep local content (dismiss conflict)
  const keepLocal = useCallback(() => {
    // Update last known remote to current content to avoid re-triggering
    lastKnownRemoteRef.current = currentContentRef.current;
    // Don't update mtime - keep tracking remote mtime for future checks
    clearConflict();
  }, [clearConflict]);

  // Reset state when file changes
  useEffect(() => {
    setState({
      hasConflict: false,
      remoteContent: null,
      lastSyncedAt: null,
      isPolling: false,
      lastKnownMtime: null,
    });
    lastKnownRemoteRef.current = null;
    lastKnownMtimeRef.current = null;
    isCheckingRef.current = false; // Reset check guard for new file
  }, [filePath]);

  // Set up polling interval
  // Use ref to avoid re-creating interval when checkNow changes
  const checkNowRef = useRef(checkNow);
  checkNowRef.current = checkNow;

  useEffect(() => {
    if (!enabled || !filePath || !basePath) return;

    // Use stable ref to avoid recreating interval
    const stableCheck = async () => {
      await checkNowRef.current();
    };

    // First check after delay, then interval
    // Using setTimeout loop to avoid duplicate intervals
    let timeoutId: NodeJS.Timeout | null = null;

    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        stableCheck().then(() => {
          scheduleNext(); // Schedule next check
        });
      }, pollInterval);
    };

    // Initial check
    const initialTimer = setTimeout(() => {
      stableCheck().then(() => {
        scheduleNext();
      });
    }, 1000); // 1 second initial delay

    return () => {
      clearTimeout(initialTimer);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, filePath, basePath, pollInterval]);

  return {
    ...state,
    clearConflict,
    checkNow,
    acceptRemote,
    keepLocal,
  };
}
