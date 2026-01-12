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
  answerQuestion: (answer: string) => void;
  cancelQuestion: () => void;
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
      setCurrentAttemptId((currentId) => {
        if (currentId) {
          socketInstance.emit('attempt:subscribe', { attemptId: currentId });
          fetch(`/api/attempts/${currentId}/status`)
            .then(res => res.json())
            .then(data => {
              if (data.status && data.status !== 'running') {
                setIsRunning(false);
                if (currentTaskIdRef.current) removeRunningTask(currentTaskIdRef.current);
              }
            })
            .catch(() => { });
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
      if (data.status === 'completed') markTaskCompleted(data.taskId);
    });

    // Message handling - SDK streams both deltas and complete messages
    socketInstance.on('output:json', (data: { attemptId: string; data: ClaudeOutput }) => {
      const { attemptId, data: output } = data;

      if (output.type === 'result') {
        setIsRunning(false);
        if (currentTaskIdRef.current) removeRunningTask(currentTaskIdRef.current);
      }

      setMessages((prev) => {
        // Handle streaming text/thinking deltas
        if (output.type === 'content_block_delta' && (output as any).delta) {
          const delta = (output as any).delta;

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

          if (existingIndex >= 0) {
            assistantMsg = { ...prev[existingIndex] };
            content = [...(assistantMsg.message?.content || [])];
          } else {
            assistantMsg = {
              type: 'assistant',
              message: { role: 'assistant', content: [] },
              _attemptId: attemptId,
              _msgId: Math.random().toString(36),
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

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = assistantMsg;
            return updated;
          }
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
        if (output.type === 'assistant') {
          const existingIndex = prev.findLastIndex(
            (m) => m.type === 'assistant' && (m as any)._attemptId === attemptId
          );
          if (existingIndex >= 0) {
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
            return updated;
          }
        }

        // Default: append new message
        return [...prev, taggedOutput];
      });
    });

    socketInstance.on('attempt:finished', (data: WsAttemptFinished) => {
      setCurrentAttemptId((currentId) => {
        if (data.attemptId === currentId) {
          setIsRunning(false);
          if (currentTaskIdRef.current) {
            removeRunningTask(currentTaskIdRef.current);
            if (data.status === 'completed') markTaskCompleted(currentTaskIdRef.current);
          }
          if (currentTaskIdRef.current && data.status === 'completed') {
            onCompleteRef.current?.(currentTaskIdRef.current);
          }
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

  // Check for running attempt on mount/taskId change
  useEffect(() => {
    if (!taskId || !isConnected) return;
    const checkRunningAttempt = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/running-attempt`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.attempt && data.attempt.status === 'running') {
          currentTaskIdRef.current = taskId;
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
        }
      } catch (error) { }
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
      setCurrentAttemptId(data.attemptId);
      socket.emit('attempt:subscribe', { attemptId: data.attemptId });
    });
    socket.emit('attempt:start', { taskId, prompt, displayPrompt, fileIds });
  }, [isConnected]);

  const answerQuestion = useCallback((answer: string) => {
    const socket = socketRef.current;
    if (!socket || !activeQuestion) return;
    socket.once('attempt:started', (data: any) => {
      setCurrentAttemptId(data.attemptId);
      setIsRunning(true);
      socket.emit('attempt:subscribe', { attemptId: data.attemptId });
    });
    socket.emit('question:answer', { attemptId: activeQuestion.attemptId, answer });
    setActiveQuestion(null);
  }, [activeQuestion]);

  const cancelQuestion = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !activeQuestion) return;
    socket.emit('question:answer', { attemptId: activeQuestion.attemptId, answer: '\x1b' });
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
