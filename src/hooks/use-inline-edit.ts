'use client';

/**
 * useInlineEdit - Hook for inline AI code editing with Socket.io streaming
 *
 * Connects the inline edit store to Socket.io events for real-time streaming.
 */

import { useEffect, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket-service';
import { useInlineEditStore, type CodeSelection } from '@/stores/inline-edit-store';
import { nanoid } from 'nanoid';
import type { DiffResult } from '@/lib/diff-generator';
import { createLogger } from '@/lib/logger';

const log = createLogger('InlineEditHook');

interface UseInlineEditOptions {
  filePath: string;
  basePath: string;
  language: string;
  /** Called when an edit is accepted */
  onAccept?: (generatedCode: string, selection: CodeSelection) => void;
  /** Called when an edit is rejected */
  onReject?: () => void;
  /** Get screen position for selection */
  getSelectionPosition?: () => { x: number; y: number } | null;
}

interface UseInlineEditResult {
  /** Start an edit session with a selection */
  startEdit: (selection: CodeSelection) => void;
  /** Submit instruction and begin generation */
  submitInstruction: (instruction: string) => void;
  /** Accept the generated code */
  accept: () => void;
  /** Reject the generated code */
  reject: () => void;
  /** Cancel the current edit */
  cancel: () => void;
  /** Whether an edit session is active */
  isActive: boolean;
  /** Current session status */
  status: string | null;
}

export function useInlineEdit(options: UseInlineEditOptions): UseInlineEditResult {
  const { filePath, basePath, language, onAccept, onReject, getSelectionPosition } = options;

  const sessionIdRef = useRef<string | null>(null);

  const {
    startSession,
    setInstruction,
    startGenerating,
    appendGeneratedCode,
    completeGeneration,
    setError,
    acceptEdit,
    rejectEdit,
    cancelEdit,
    openDialog,
    getSession,
    hasActiveSession,
  } = useInlineEditStore();

  // Set up socket event handlers
  useEffect(() => {
    const socket = getSocket();
    log.debug({ filePath, socketId: socket.id }, 'Setting up handlers');

    const handleDelta = (data: { sessionId: string; chunk: string }) => {
      log.debug({ sessionId: data.sessionId, expected: sessionIdRef.current }, 'Received delta');
      if (data.sessionId === sessionIdRef.current) {
        appendGeneratedCode(filePath, data.chunk);
      }
    };

    const handleComplete = (data: { sessionId: string; code: string; diff: DiffResult }) => {
      log.debug({ sessionId: data.sessionId, expected: sessionIdRef.current }, 'Received complete');
      if (data.sessionId === sessionIdRef.current) {
        log.debug('Calling completeGeneration');
        completeGeneration(filePath, data.code, data.diff);
      }
    };

    const handleError = (data: { sessionId: string; error: string }) => {
      log.debug({ sessionId: data.sessionId, expected: sessionIdRef.current, error: data.error }, 'Received error');
      if (data.sessionId === sessionIdRef.current) {
        setError(filePath, data.error);
      }
    };

    socket.on('inline-edit:delta', handleDelta);
    socket.on('inline-edit:complete', handleComplete);
    socket.on('inline-edit:error', handleError);
    log.debug({ listenersCount: socket.listeners('inline-edit:complete').length }, 'Handlers registered');

    return () => {
      log.debug({ filePath }, 'Removing handlers');
      socket.off('inline-edit:delta', handleDelta);
      socket.off('inline-edit:complete', handleComplete);
      socket.off('inline-edit:error', handleError);
    };
  }, [filePath, appendGeneratedCode, completeGeneration, setError]);

  // Start an edit session
  const startEdit = useCallback(
    (selection: CodeSelection) => {
      const sessionId = nanoid();
      sessionIdRef.current = sessionId;

      startSession(filePath, sessionId, selection);

      // Get position from callback if available
      const position = getSelectionPosition?.() || null;
      openDialog(filePath, position || undefined);
    },
    [filePath, startSession, openDialog, getSelectionPosition]
  );

  // Submit instruction to start generation
  const submitInstruction = useCallback(
    async (instruction: string) => {
      const session = getSession(filePath);
      if (!session) return;

      setInstruction(filePath, instruction);
      startGenerating(filePath);

      const socket = getSocket();
      if (!socket.connected) {
        setError(filePath, 'Socket not connected');
        return;
      }
      log.debug({ socketId: socket.id, connected: socket.connected }, 'Using socket');

      // Subscribe to session events and wait for acknowledgment
      log.debug({ sessionId: session.sessionId }, 'Subscribing to session');
      sessionIdRef.current = session.sessionId; // Ensure ref is set before subscribing
      await new Promise<void>((resolve) => {
        socket.emit('inline-edit:subscribe', { sessionId: session.sessionId }, () => {
          log.debug({ sessionId: session.sessionId }, 'Subscription confirmed');
          resolve();
        });
        // Fallback timeout in case ack doesn't come
        setTimeout(() => {
          log.debug('Subscription timeout fallback');
          resolve();
        }, 100);
      });

      // Start edit via socket (same module context as event handlers)
      log.debug({ sessionId: session.sessionId }, 'Starting edit via socket');
      socket.emit(
        'inline-edit:start',
        {
          sessionId: session.sessionId,
          basePath,
          filePath,
          language,
          selectedCode: session.originalCode,
          instruction,
        },
        (result: { success: boolean; error?: string }) => {
          if (!result.success) {
            setError(filePath, result.error || 'Failed to start edit');
          }
        }
      );
    },
    [filePath, basePath, language, getSession, setInstruction, startGenerating, setError]
  );

  // Accept the generated code
  const accept = useCallback(() => {
    const session = getSession(filePath);
    if (!session || session.status !== 'preview') return;

    const generatedCode = acceptEdit(filePath);
    if (generatedCode && onAccept) {
      onAccept(generatedCode, session.selection);
    }
  }, [filePath, getSession, acceptEdit, onAccept]);

  // Reject the generated code
  const reject = useCallback(() => {
    rejectEdit(filePath);
    onReject?.();
  }, [filePath, rejectEdit, onReject]);

  // Cancel the current edit
  const cancel = useCallback(() => {
    const socket = getSocket();
    const sessionId = sessionIdRef.current;

    if (socket.connected && sessionId) {
      socket.emit('inline-edit:cancel', { sessionId });
    }

    cancelEdit(filePath);
  }, [filePath, cancelEdit]);

  const session = getSession(filePath);

  return {
    startEdit,
    submitInstruction,
    accept,
    reject,
    cancel,
    isActive: hasActiveSession(filePath),
    status: session?.status || null,
  };
}
