'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClaudeOutput, WsAttemptFinished } from '@/types';

interface UseAttemptStreamOptions {
  taskId?: string;
  onComplete?: (taskId: string) => void;
}

interface UseAttemptStreamResult {
  messages: ClaudeOutput[];
  isConnected: boolean;
  startAttempt: (taskId: string, prompt: string, displayPrompt?: string) => void;
  currentAttemptId: string | null;
  currentPrompt: string | null;
  isRunning: boolean;
}

export function useAttemptStream(
  options?: UseAttemptStreamOptions
): UseAttemptStreamResult {
  const taskId = options?.taskId;
  const onCompleteRef = useRef(options?.onComplete);
  const socketRef = useRef<Socket | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<ClaudeOutput[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Keep callback ref updated
  onCompleteRef.current = options?.onComplete;

  useEffect(() => {
    // Use default Socket.io path (no custom path)
    const socketInstance = io({
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('Attempt stream socket connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Attempt stream socket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connect error:', err);
    });

    // Listen for JSON output from Claude
    socketInstance.on('output:json', (data: { attemptId: string; data: ClaudeOutput }) => {
      console.log('[useAttemptStream] Received output:json', data.attemptId, data.data?.type);
      setCurrentAttemptId((currentId) => {
        if (data.attemptId === currentId) {
          setMessages((prev) => {
            // For 'assistant' messages, replace the last one instead of appending
            // This prevents duplication since assistant messages contain accumulated content
            if (data.data.type === 'assistant') {
              const lastIndex = prev.findLastIndex((m) => m.type === 'assistant');
              if (lastIndex >= 0) {
                const newMessages = [...prev];
                newMessages[lastIndex] = data.data;
                return newMessages;
              }
            }
            return [...prev, data.data];
          });
        }
        return currentId;
      });
    });

    // Listen for raw output
    socketInstance.on('output:raw', (data: { attemptId: string; content: string }) => {
      console.log('Received output:raw', data.attemptId);
    });

    // Listen for stderr
    socketInstance.on('output:stderr', (data: { attemptId: string; content: string }) => {
      console.log('Received output:stderr', data.content);
    });

    // Listen for attempt finished
    socketInstance.on('attempt:finished', (data: WsAttemptFinished) => {
      console.log('Attempt finished:', data);
      setCurrentAttemptId((currentId) => {
        if (data.attemptId === currentId) {
          setIsRunning(false);
          // Call onComplete callback with taskId
          if (currentTaskIdRef.current && data.status === 'completed') {
            onCompleteRef.current?.(currentTaskIdRef.current);
          }
        }
        return currentId;
      });
    });

    // Listen for errors
    socketInstance.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      setIsRunning(false);
    });

    return () => {
      socketInstance.close();
      socketRef.current = null;
    };
  }, []);

  // Check for running attempt when taskId changes or socket connects
  useEffect(() => {
    if (!taskId || !isConnected) return;

    const checkRunningAttempt = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/running-attempt`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.attempt && data.attempt.status === 'running') {
          console.log('[useAttemptStream] Found running attempt:', data.attempt.id);
          currentTaskIdRef.current = taskId;
          setCurrentAttemptId(data.attempt.id);
          setCurrentPrompt(data.attempt.prompt);
          setMessages(data.messages || []);
          setIsRunning(true);

          // Subscribe to this attempt's output
          socketRef.current?.emit('attempt:subscribe', { attemptId: data.attempt.id });
        }
      } catch (error) {
        console.error('Failed to check running attempt:', error);
      }
    };

    checkRunningAttempt();
  }, [taskId, isConnected]);

  const startAttempt = useCallback(
    (taskId: string, prompt: string, displayPrompt?: string) => {
      const socket = socketRef.current;
      if (!socket || !isConnected) {
        console.error('Socket not connected, cannot start attempt');
        return;
      }

      console.log('Starting attempt for task:', taskId);
      currentTaskIdRef.current = taskId;
      setMessages([]);
      setCurrentPrompt(displayPrompt || prompt);
      setIsRunning(true);

      // Listen for the new attempt ID
      socket.once('attempt:started', (data: { attemptId: string; taskId: string }) => {
        console.log('Attempt started:', data.attemptId);
        setCurrentAttemptId(data.attemptId);
        // Subscribe to this attempt's output
        socket.emit('attempt:subscribe', { attemptId: data.attemptId });
      });

      socket.emit('attempt:start', { taskId, prompt, displayPrompt });
    },
    [isConnected]
  );

  return {
    messages,
    isConnected,
    startAttempt,
    currentAttemptId,
    currentPrompt,
    isRunning,
  };
}
