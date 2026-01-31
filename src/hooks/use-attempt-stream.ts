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
  startAttempt: (taskId: string, prompt: string, displayPrompt?: string, fileIds?: string[], model?: string) => void;
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
      // Only subscribe if this attempt is for the current task we're viewing
      if (data.taskId === taskId) {
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
        return; // EARLY RETURN - skip this message entirely
      }

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
            return updated;
          }
        }

        // Default: append new message
        // Mark assistant messages as streaming-created so they can be merge targets
        const finalOutput = output.type === 'assistant'
          ? { ...taggedOutput, _fromStreaming: true }
          : taggedOutput;
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
      console.log('[useAttemptStream] Received question:ask event', data);
      // Filter by current attemptId to prevent cross-task question leaking
      if (currentAttemptIdRef.current && data.attemptId !== currentAttemptIdRef.current) {
        console.log('[useAttemptStream] Ignoring question from different attempt', {
          receivedAttemptId: data.attemptId,
          currentAttemptId: currentAttemptIdRef.current,
        });
        return;
      }
      setActiveQuestion({ attemptId: data.attemptId, toolUseId: data.toolUseId, questions: data.questions });
    });

    return () => {
      socketInstance.close();
      socketRef.current = null;
    };
  }, []);

  // Clear messages and reset state when taskId changes
  useEffect(() => {
    // Clear previous task's messages
    setMessages([]);
    setCurrentAttemptId(null);
    currentAttemptIdRef.current = null; // CRITICAL: Sync ref to prevent stale filtering
    setCurrentPrompt(null);
    setIsRunning(false);
    setActiveQuestion(null);
    // Don't clear currentTaskIdRef here - we'll update it in checkRunningAttempt
  }, [taskId]);

  // Helper to scan messages for unanswered AskUserQuestion tools
  const checkForUnansweredQuestion = useCallback((messages: ClaudeOutput[], attemptId: string) => {
    // Build a set of tool_use_ids that have results
    // Check both top-level tool_result messages (from conversation API)
    // and tool_result content blocks inside user messages (from running-attempt raw logs)
    const answeredToolIds = new Set<string>();
    // Also track if any user_answer log exists (saved by answer API as fallback)
    let hasUserAnswerLog = false;
    for (const msg of messages) {
      if (msg.type === 'tool_result' && msg.tool_data?.tool_use_id) {
        answeredToolIds.add(String(msg.tool_data.tool_use_id));
      }
      // Check user messages with tool_result content blocks (raw streaming logs)
      if (msg.type === 'user' && msg.message?.content) {
        for (const block of msg.message.content) {
          if ((block as any).type === 'tool_result' && (block as any).tool_use_id) {
            answeredToolIds.add(String((block as any).tool_use_id));
          }
        }
      }
      // Detect user_answer logs (saved by /api/attempts/[id]/answer)
      // These indicate a question was answered even if tool_result hasn't been logged yet
      if ((msg as any).type === 'user_answer') {
        hasUserAnswerLog = true;
      }
    }
    console.log('[checkForUnansweredQuestion] Answered tool IDs', Array.from(answeredToolIds), 'hasUserAnswerLog', hasUserAnswerLog);

    // Collect all AskUserQuestion tool_use_ids from messages (in order)
    const askQuestionIds: string[] = [];
    for (const msg of messages) {
      if (msg.type === 'tool_use' && msg.tool_name === 'AskUserQuestion' && msg.id) {
        askQuestionIds.push(msg.id);
      }
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if ((block as any).type === 'tool_use' &&
              (block as any).name === 'AskUserQuestion' &&
              (block as any).id) {
            askQuestionIds.push(String((block as any).id));
          }
        }
      }
    }

    // If user_answer log exists but no tool_result matched, mark the last AskUserQuestion as answered
    // This handles the timing gap where answer was saved but SDK hasn't sent tool_result yet
    if (hasUserAnswerLog && askQuestionIds.length > 0) {
      const lastAskId = askQuestionIds[askQuestionIds.length - 1];
      if (!answeredToolIds.has(lastAskId)) {
        console.log('[checkForUnansweredQuestion] Marking last AskUserQuestion as answered via user_answer log', lastAskId);
        answeredToolIds.add(lastAskId);
      }
    }

    // Find first unanswered AskUserQuestion
    for (const msg of messages) {
      if (msg.type === 'tool_use' && msg.tool_name === 'AskUserQuestion' && msg.id) {
        if (!answeredToolIds.has(msg.id)) {
          // Found unanswered question - restore activeQuestion state
          const questions = (msg as any).tool_data?.questions;
          if (questions && Array.isArray(questions)) {
            setActiveQuestion({
              attemptId,
              toolUseId: msg.id,
              questions
            });
            return; // Only restore the first unanswered question
          }
        }
      }
      // Also check assistant messages with content blocks
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if ((block as any).type === 'tool_use' &&
              (block as any).name === 'AskUserQuestion' &&
              (block as any).id) {
            const toolUseId = String((block as any).id);
            if (!answeredToolIds.has(toolUseId)) {
              const questions = (block as any).input?.questions;
              if (questions && Array.isArray(questions)) {
                setActiveQuestion({
                  attemptId,
                  toolUseId,
                  questions
                });
                return;
              }
            }
          }
        }
      }
    }
  }, []);

  // Check for running attempt on mount/taskId change
  useEffect(() => {
    if (!taskId) return;
    const checkRunningAttempt = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/running-attempt`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.attempt && data.attempt.status === 'running') {
          currentTaskIdRef.current = taskId;
          currentAttemptIdRef.current = data.attempt.id; // CRITICAL: Sync ref BEFORE state for immediate filtering
          setCurrentAttemptId(data.attempt.id);
          setCurrentPrompt(data.attempt.prompt);
          const loadedMessages = (data.messages || []).map((m: any) => ({
            ...m,
            _attemptId: data.attempt.id,
            _msgId: Math.random().toString(36)
          }));
          setMessages(loadedMessages);
          setIsRunning(true);
          addRunningTask(taskId);

          // Check for unanswered AskUserQuestion in loaded messages
          // This restores activeQuestion state after server restart
          checkForUnansweredQuestion(loadedMessages, data.attempt.id);

          // Only subscribe if socket is connected
          if (isConnected) {
            socketRef.current?.emit('attempt:subscribe', { attemptId: data.attempt.id });
          }
        } else {
          // No running attempt, but check conversation history for unanswered AskUserQuestion
          // This handles the case where the attempt status changed but question wasn't answered
          try {
            const historyRes = await fetch(`/api/tasks/${taskId}/conversation`);
            if (historyRes.ok) {
              const historyData = await historyRes.json();
              // Only check the MOST RECENT turn (last one), not all history
              // This avoids showing old questions from previous conversations
              const turns = historyData.turns || [];
              if (turns.length > 0) {
                const lastTurn = turns[turns.length - 1];
                // Always restore unanswered questions from the most recent turn
                // But only if the attempt is actually alive (has active agent process)
                if (lastTurn.attemptId) {
                  const lastTurnMessages = lastTurn.messages || [];
                  // First check if the attempt is actually alive (has active agent)
                  try {
                    const aliveRes = await fetch(`/api/attempts/${lastTurn.attemptId}/alive`);
                    if (aliveRes.ok) {
                      const aliveData = await aliveRes.json();
                      if (aliveData.alive) {
                        // Attempt has an active agent, can restore the question
                        checkForUnansweredQuestion(lastTurnMessages, lastTurn.attemptId);
                      }
                    }
                  } catch {
                    // Failed to check attempt alive status
                  }
                }
              }
            }
          } catch {
            // Failed to load conversation history
          }
          // Ensure currentTaskIdRef is updated
          currentTaskIdRef.current = taskId;
        }
      } catch {
        // Ensure currentTaskIdRef is updated even on error
        currentTaskIdRef.current = taskId;
      }
    };
    checkRunningAttempt();
  }, [taskId, checkForUnansweredQuestion]); // Remove isConnected from deps - we handle it inside

  const startAttempt = useCallback((taskId: string, prompt: string, displayPrompt?: string, fileIds?: string[], model?: string) => {
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
    socket.emit('attempt:start', { taskId, prompt, displayPrompt, fileIds, model });
  }, [isConnected]);

  const answerQuestion = useCallback(async (questions: Question[], answers: Record<string, string>) => {
    const socket = socketRef.current;
    if (!socket || !activeQuestion) return;

    const attemptId = activeQuestion.attemptId;

    // Send SDK format: { attemptId, questions, answers }
    // The agent-manager's canUseTool callback will resume streaming
    socket.emit('question:answer', {
      attemptId,
      questions,
      answers,
    });

    // Save answer to database for persistence across reloads
    try {
      await fetch(`/api/attempts/${attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, answers })
      });
    } catch (err) {
      console.error('Failed to save answer to database:', err);
    }

    // Add a message showing the user's answer to the conversation
    // This creates a record of what the user chose
    const answerText = Object.entries(answers)
      .map(([question, answer]) => `${question}: **${answer}**`)
      .join('\n');
    setMessages((prev) => [
      ...prev,
      {
        type: 'assistant' as const,
        message: {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: `✓ **You answered:**\n${answerText}` }]
        },
        _attemptId: attemptId,
        _msgId: Math.random().toString(36)
      }
    ]);

    // Delay hiding the question dialog to prevent click event from hitting Stop button
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
