'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClaudeOutput, WsAttemptFinished } from '@/types';
import { useRunningTasksStore } from '@/stores/running-tasks-store';

interface UseAttemptStreamOptions {
  taskId?: string;
  onComplete?: (taskId: string) => void;
}

// Question types for AskUserQuestion
interface QuestionOption {
  label: string;
  description: string;
}

interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

interface ActiveQuestion {
  attemptId: string;
  toolUseId: string;
  questions: Question[];
}

interface UseAttemptStreamResult {
  messages: ClaudeOutput[];
  isConnected: boolean;
  startAttempt: (taskId: string, prompt: string, displayPrompt?: string, fileIds?: string[]) => void;
  cancelAttempt: () => void;
  currentAttemptId: string | null;
  currentPrompt: string | null;
  isRunning: boolean;
  activeQuestion: ActiveQuestion | null;
  answerQuestion: (questions: Question[], answers: Record<string, string>) => void;
  cancelQuestion: () => void;
}

export function useAttemptStream(
  options?: UseAttemptStreamOptions
): UseAttemptStreamResult {
  const taskId = options?.taskId;
  const onCompleteRef = useRef(options?.onComplete);
  const socketRef = useRef<Socket | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  // CRITICAL: Use ref to track currentAttemptId for synchronous filtering in socket callbacks
  // State is async and cannot be used to filter messages in real-time
  const currentAttemptIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<ClaudeOutput[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  const { addRunningTask, removeRunningTask, markTaskCompleted } = useRunningTasksStore();

  // Keep callback ref updated
  onCompleteRef.current = options?.onComplete;

  useEffect(() => {
    const socketInstance = io({
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('Attempt stream socket connected:', socketInstance.id);
      setIsConnected(true);
      // Re-subscribe to current attempt room on reconnect
      // State validation is handled by checkRunningAttempt effect
      setCurrentAttemptId((currentId) => {
        if (currentId) {
          socketInstance.emit('attempt:subscribe', { attemptId: currentId });
        }
        return currentId;
      });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('task:started', (data: { taskId: string }) => {
      addRunningTask(data.taskId);
    });

    socketInstance.on('task:finished', (data: { taskId: string; status: string }) => {
      removeRunningTask(data.taskId);
      if (data.status === 'completed') {
        markTaskCompleted(data.taskId);
        // Move task to in_review regardless of which task user is viewing
        onCompleteRef.current?.(data.taskId);
      }
    });

    // Handle attempt started event (from REST API or WebSocket)
    // Auto-subscribe if we're viewing this task
    socketInstance.on('attempt:started', (data: { attemptId: string; taskId: string }) => {
      console.log('[useAttemptStream] Received attempt:started', { attemptId: data.attemptId, taskId: data.taskId, currentTaskId: taskId });
      // Only subscribe if this attempt is for the current task we're viewing
      if (data.taskId === taskId) {
        console.log('[useAttemptStream] Auto-subscribing to attempt', data.attemptId);
        currentTaskIdRef.current = data.taskId;
        currentAttemptIdRef.current = data.attemptId; // CRITICAL: Sync ref BEFORE state for immediate filtering
        setCurrentAttemptId(data.attemptId);
        setIsRunning(true);
        addRunningTask(data.taskId);
        socketInstance.emit('attempt:subscribe', { attemptId: data.attemptId });
      }
    });

    // Message handling - SDK streams both deltas and complete messages
    socketInstance.on('output:json', (data: { attemptId: string; data: ClaudeOutput }) => {
      const { attemptId, data: output } = data;

      // CRITICAL: Filter messages by attemptId to prevent cross-task streaming
      // When multiple tasks are running, socket receives messages from ALL attempts
      // Only process messages that belong to the current attempt
      // Use ref for SYNCHRONOUS filtering - state is async and unreliable for real-time filtering
      if (currentAttemptIdRef.current && attemptId !== currentAttemptIdRef.current) {
        console.log('[useAttemptStream] Ignoring message from different attempt', {
          receivedAttemptId: attemptId,
          currentAttemptId: currentAttemptIdRef.current,
          outputType: output.type
        });
        return; // EARLY RETURN - skip this message entirely
      }

      console.log('[useAttemptStream] Received output:json', { attemptId, type: output.type });

      if (output.type === 'result') {
        setIsRunning(false);
        if (currentTaskIdRef.current) removeRunningTask(currentTaskIdRef.current);
      }

      setMessages((prev) => {
        console.log('[useAttemptStream] setMessages called', { prevLength: prev.length, outputType: output.type });

        // Handle streaming text/thinking deltas
        if (output.type === 'content_block_delta' && (output as any).delta) {
          const delta = (output as any).delta;
          console.log('[useAttemptStream] Received delta', { deltaType: delta.type, hasText: !!delta.text, hasThinking: !!delta.thinking });

          // Only handle text and thinking deltas
          if (delta.type !== 'text_delta' && delta.type !== 'thinking_delta') {
            return prev; // Ignore other deltas (tool streaming works fine)
          }

          // Find or create assistant message for this attempt
          const existingIndex = prev.findLastIndex(
            (m) => m.type === 'assistant' && (m as any)._attemptId === attemptId
          );

          let assistantMsg: any;
          let content: any[];

          if (existingIndex >= 0 && (prev[existingIndex] as any)._fromStreaming) {
            assistantMsg = { ...prev[existingIndex] };
            content = [...(assistantMsg.message?.content || [])];
          } else {
            assistantMsg = {
              type: 'assistant',
              message: { role: 'assistant', content: [] },
              _attemptId: attemptId,
              _msgId: Math.random().toString(36),
              _fromStreaming: true,
            };
            content = [];
          }

          // Accumulate text delta
          if (delta.type === 'text_delta' && delta.text) {
            const textBlockIndex = content.findIndex((b: any) => b.type === 'text');
            if (textBlockIndex >= 0) {
              content[textBlockIndex] = {
                ...content[textBlockIndex],
                text: (content[textBlockIndex].text || '') + delta.text,
              };
            } else {
              content.push({ type: 'text', text: delta.text });
            }
          }

          // Accumulate thinking delta
          if (delta.type === 'thinking_delta' && delta.thinking) {
            const thinkingBlockIndex = content.findIndex((b: any) => b.type === 'thinking');
            if (thinkingBlockIndex >= 0) {
              content[thinkingBlockIndex] = {
                ...content[thinkingBlockIndex],
                thinking: (content[thinkingBlockIndex].thinking || '') + delta.thinking,
              };
            } else {
              content.push({ type: 'thinking', thinking: delta.thinking });
            }
          }

          assistantMsg.message = { ...assistantMsg.message, content };

          // Only update if we found an existing streaming message
          const shouldUpdate = existingIndex >= 0 && (prev[existingIndex] as any)._fromStreaming;
          if (shouldUpdate) {
            const updated = [...prev];
            updated[existingIndex] = assistantMsg;
            console.log('[useAttemptStream] Updated assistant message with delta', { textLength: content.find((b: any) => b.type === 'text')?.text?.length });
            return updated;
          }
          console.log('[useAttemptStream] Created new assistant message with delta');
          return [...prev, assistantMsg];
        }

        // Generate unique ID for this message
        const msgId = Math.random().toString(36);
        const taggedOutput = { ...output, _attemptId: attemptId, _msgId: msgId } as ClaudeOutput & { _attemptId: string; _msgId: string };

        // For tool_use messages, try to update existing or append
        if (output.type === 'tool_use' && output.id) {
          const existingIndex = prev.findIndex(
            (m) => m.type === 'tool_use' && m.id === output.id
          );
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = taggedOutput;
            return updated;
          }
        }

        // For tool_result messages, update existing by tool_use_id
        if (output.type === 'tool_result' && output.tool_data?.tool_use_id) {
          const toolUseId = output.tool_data.tool_use_id;
          const existingIndex = prev.findIndex(
            (m) => m.type === 'tool_result' && m.tool_data?.tool_use_id === toolUseId
          );
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = taggedOutput;
            return updated;
          }
        }

        // For assistant messages, update the last assistant message for the same attempt
        // ONLY merge if:
        // 1. Message has _fromStreaming flag (created during streaming, not loaded from API)
        // 2. It's the LAST message in the array (same turn, not a new turn)
        // If there's a tool_result or user message after, this is a NEW turn - append instead
        if (output.type === 'assistant') {
          const lastMsg = prev[prev.length - 1];
          const isLastMsgStreamingAssistant = lastMsg?.type === 'assistant' && (lastMsg as any)._fromStreaming;

          // Only merge if the last message is a streaming assistant (same turn)
          if (isLastMsgStreamingAssistant) {
            const existingIndex = prev.length - 1;
            const existing = prev[existingIndex] as any;
            const existingContent = existing.message?.content || [];
            const newContent = output.message?.content || [];

            // Merge content blocks: keep existing blocks, update/add new ones
            const mergedContent = [...existingContent];
            for (const newBlock of newContent) {
              const blockIndex = mergedContent.findIndex(
                (b: any) => b.type === newBlock.type && (
                  (newBlock.type === 'tool_use' && b.id === newBlock.id) ||
                  (newBlock.type !== 'tool_use')
                )
              );

              if (blockIndex >= 0 && newBlock.type !== 'tool_use') {
                // Update non-tool_use block (text, thinking)
                const oldBlock = mergedContent[blockIndex];
                if (newBlock.type === 'text') {
                  // Keep the longer text
                  if ((newBlock.text?.length || 0) >= (oldBlock.text?.length || 0)) {
                    mergedContent[blockIndex] = newBlock;
                  }
                } else if (newBlock.type === 'thinking') {
                  // Keep the longer thinking
                  if ((newBlock.thinking?.length || 0) >= (oldBlock.thinking?.length || 0)) {
                    mergedContent[blockIndex] = newBlock;
                  }
                } else {
                  mergedContent[blockIndex] = newBlock;
                }
              } else if (blockIndex < 0) {
                // New block, append it
                mergedContent.push(newBlock);
              }
            }

            const updated = [...prev];
            updated[existingIndex] = {
              ...existing,
              message: { ...output.message, content: mergedContent },
              _attemptId: attemptId,
            };
            console.log('[useAttemptStream] Merged assistant message at index', existingIndex);
            return updated;
          }
        }

        // Default: append new message
        // Mark assistant messages as streaming-created so they can be merge targets
        const finalOutput = output.type === 'assistant'
          ? { ...taggedOutput, _fromStreaming: true }
          : taggedOutput;
        console.log('[useAttemptStream] Appending new message', { type: output.type, newLength: prev.length + 1 });
        return [...prev, finalOutput];
      });
    });

    socketInstance.on('attempt:finished', (data: WsAttemptFinished) => {
      setCurrentAttemptId((currentId) => {
        if (data.attemptId === currentId) {
          setIsRunning(false);
          // Note: removeRunningTask, markTaskCompleted, and onComplete are now handled by task:finished
          // which fires regardless of which task user is viewing
        }
        return currentId;
      });
    });

    socketInstance.on('error', (data: { message: string }) => {
      setIsRunning(false);
      if (currentTaskIdRef.current) removeRunningTask(currentTaskIdRef.current);
    });

    socketInstance.on('question:ask', (data: any) => {
      setActiveQuestion({ attemptId: data.attemptId, toolUseId: data.toolUseId, questions: data.questions });
    });

    return () => {
      socketInstance.close();
      socketRef.current = null;
    };
  }, []);

  // Clear messages and reset state when taskId changes
  useEffect(() => {
    console.log('[useAttemptStream] TaskId changed, clearing state', { oldTaskId: currentTaskIdRef.current, newTaskId: taskId });
    // Clear previous task's messages
    setMessages([]);
    setCurrentAttemptId(null);
    currentAttemptIdRef.current = null; // CRITICAL: Sync ref to prevent stale filtering
    setCurrentPrompt(null);
    setIsRunning(false);
    setActiveQuestion(null);
    // Don't clear currentTaskIdRef here - we'll update it in checkRunningAttempt
  }, [taskId]);

  // Check for running attempt on mount/taskId change
  useEffect(() => {
    if (!taskId || !isConnected) return;
    console.log('[useAttemptStream] checkRunningAttempt triggered', { taskId, isConnected });
    const checkRunningAttempt = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/running-attempt`);
        if (!res.ok) return;
        const data = await res.json();
        console.log('[useAttemptStream] running-attempt API response', data);
        if (data.attempt && data.attempt.status === 'running') {
          console.log('[useAttemptStream] Found running attempt, subscribing...', data.attempt.id);
          currentTaskIdRef.current = taskId;
          currentAttemptIdRef.current = data.attempt.id; // CRITICAL: Sync ref BEFORE state for immediate filtering
          setCurrentAttemptId(data.attempt.id);
          setCurrentPrompt(data.attempt.prompt);
          setMessages((data.messages || []).map((m: any) => ({
            ...m,
            _attemptId: data.attempt.id,
            _msgId: Math.random().toString(36)
          })));
          setIsRunning(true);
          addRunningTask(taskId);
          socketRef.current?.emit('attempt:subscribe', { attemptId: data.attempt.id });
          console.log('[useAttemptStream] Emitted attempt:subscribe for', data.attempt.id);
        } else {
          // No running attempt for this task, ensure currentTaskIdRef is updated
          currentTaskIdRef.current = taskId;
        }
      } catch (error) {
        console.error('[useAttemptStream] checkRunningAttempt error', error);
        // Ensure currentTaskIdRef is updated even on error
        currentTaskIdRef.current = taskId;
      }
    };
    checkRunningAttempt();
  }, [taskId, isConnected]);

  const startAttempt = useCallback((taskId: string, prompt: string, displayPrompt?: string, fileIds?: string[]) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;
    currentTaskIdRef.current = taskId;
    setMessages([]);
    setCurrentPrompt(displayPrompt || prompt);
    setIsRunning(true);
    addRunningTask(taskId);
    socket.once('attempt:started', (data: any) => {
      currentAttemptIdRef.current = data.attemptId; // CRITICAL: Sync ref BEFORE state for immediate filtering
      setCurrentAttemptId(data.attemptId);
      socket.emit('attempt:subscribe', { attemptId: data.attemptId });
    });
    socket.emit('attempt:start', { taskId, prompt, displayPrompt, fileIds });
  }, [isConnected]);

  const answerQuestion = useCallback((questions: Question[], answers: Record<string, string>) => {
    const socket = socketRef.current;
    if (!socket || !activeQuestion) return;
    // Send SDK format: { attemptId, questions, answers }
    // The agent-manager's canUseTool callback will resume streaming
    socket.emit('question:answer', {
      attemptId: activeQuestion.attemptId,
      questions,
      answers,
    });
    // Delay hiding the question dialog to prevent click event from hitting Stop button
    // (Stop button renders at similar position when PromptInput replaces QuestionPrompt)
    setTimeout(() => setActiveQuestion(null), 250);
  }, [activeQuestion]);

  const cancelQuestion = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !activeQuestion) return;
    // Send empty answers to signal cancellation
    socket.emit('question:cancel', { attemptId: activeQuestion.attemptId });
    setActiveQuestion(null);
  }, [activeQuestion]);

  const cancelAttempt = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !currentAttemptId) return;
    socket.emit('attempt:cancel', { attemptId: currentAttemptId });
    setIsRunning(false);
    setActiveQuestion(null);
    if (currentTaskIdRef.current) removeRunningTask(currentTaskIdRef.current);
  }, [currentAttemptId]);

  return { messages, isConnected, startAttempt, cancelAttempt, currentAttemptId, currentPrompt, isRunning, activeQuestion, answerQuestion, cancelQuestion };
}
