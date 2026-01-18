'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBlock } from '@/components/claude/message-block';
import { ToolUseBlock } from '@/components/claude/tool-use-block';
import { RunningDots, useRandomStatusVerb } from '@/components/ui/running-dots';
import { cn } from '@/lib/utils';
import type { ClaudeOutput, ClaudeContentBlock, AttemptFile, PendingFile } from '@/types';

interface ConversationTurn {
  type: 'user' | 'assistant';
  prompt?: string;
  messages: ClaudeOutput[];
  attemptId: string;
  timestamp: number;
  files?: AttemptFile[];
}

interface ConversationViewProps {
  taskId: string;
  currentMessages: ClaudeOutput[];
  currentAttemptId: string | null;
  currentPrompt?: string;
  currentFiles?: PendingFile[];
  isRunning: boolean;
  className?: string;
  onHistoryLoaded?: (hasHistory: boolean) => void;
}

// Build a map of tool results from messages
function buildToolResultsMap(messages: ClaudeOutput[]): Map<string, { result: string; isError: boolean }> {
  const map = new Map<string, { result: string; isError: boolean }>();
  for (const msg of messages) {
    // Tool result messages have tool_data.tool_use_id that references the tool_use
    if (msg.type === 'tool_result') {
      // Try multiple paths for tool_use_id
      const toolUseId = (msg.tool_data?.tool_use_id as string) || (msg.tool_data?.id as string);
      if (toolUseId) {
        // Handle result being either a string or an object like {type, text}
        let resultStr = '';
        if (typeof msg.result === 'string') {
          resultStr = msg.result;
        } else if (msg.result && typeof msg.result === 'object') {
          const resultObj = msg.result as { type?: string; text?: string };
          if (resultObj.text) {
            resultStr = resultObj.text;
          } else {
            resultStr = JSON.stringify(msg.result);
          }
        }
        map.set(toolUseId, {
          result: resultStr,
          isError: msg.is_error || false,
        });
      }
    }
  }
  return map;
}

// Check if messages have visible content (text, thinking, or tool_use)
// Used to keep "Thinking..." spinner until actual content appears
function hasVisibleContent(messages: ClaudeOutput[]): boolean {
  return messages.some(msg => {
    // Assistant message with content blocks
    if (msg.type === 'assistant' && msg.message?.content?.length) {
      return msg.message.content.some(block =>
        (block.type === 'text' && block.text) ||
        (block.type === 'thinking' && block.thinking) ||
        block.type === 'tool_use'
      );
    }
    // Top-level tool_use message
    if (msg.type === 'tool_use') return true;
    return false;
  });
}

// Find the last tool_use ID across all messages (globally)
function findLastToolUseId(messages: ClaudeOutput[]): string | null {
  let lastToolUseId: string | null = null;
  for (const msg of messages) {
    // Check assistant message content blocks
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'tool_use' && block.id) {
          lastToolUseId = block.id;
        }
      }
    }
    // Check top-level tool_use messages
    if (msg.type === 'tool_use' && msg.id) {
      lastToolUseId = msg.id;
    }
  }
  return lastToolUseId;
}

// Check if this is the last tool_use globally (still executing)
function isToolExecuting(
  toolId: string,
  lastToolUseId: string | null,
  toolResultsMap: Map<string, { result: string; isError: boolean }>,
  isStreaming: boolean
): boolean {
  if (!isStreaming) return false;
  // If we have a result, it's not executing
  if (toolResultsMap.has(toolId)) return false;
  // Only the LAST tool_use globally is executing
  return toolId === lastToolUseId;
}

export function ConversationView({
  taskId,
  currentMessages,
  currentAttemptId,
  currentPrompt,
  currentFiles,
  isRunning,
  className,
}: ConversationViewProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [historicalTurns, setHistoricalTurns] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastIsRunning, setLastIsRunning] = useState(isRunning);
  const statusVerb = useRandomStatusVerb();

  // Check if user is near bottom of scroll area (within threshold)
  const isNearBottom = () => {
    const detachedContainer = scrollAreaRef.current?.closest('[data-detached-scroll-container]');
    if (detachedContainer) {
      const threshold = 150;
      return detachedContainer.scrollHeight - detachedContainer.scrollTop - detachedContainer.clientHeight < threshold;
    }

    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (!viewport) return true;
    const threshold = 150; // pixels from bottom
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold;
  };

  // Scroll to bottom of scroll area viewport (only if user is near bottom)
  const scrollToBottomIfNear = () => {
    if (isNearBottom()) {
      const detachedContainer = scrollAreaRef.current?.closest('[data-detached-scroll-container]');
      if (detachedContainer) {
        detachedContainer.scrollTop = detachedContainer.scrollHeight;
      } else {
        const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    }
  };

  // Force scroll to bottom (bypasses isNearBottom check)
  const scrollToBottom = () => {
    const detachedContainer = scrollAreaRef.current?.closest('[data-detached-scroll-container]');
    if (detachedContainer) {
      detachedContainer.scrollTop = detachedContainer.scrollHeight;
    } else {
      const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  };

  // Scroll to bottom with retry for better reliability (especially in detached mode)
  const scrollToBottomWithRetry = (attempts = 3) => {
    const attemptScroll = (remainingAttempts: number) => {
      // Check if we're in a detached window
      const detachedContainer = scrollAreaRef.current?.closest('[data-detached-scroll-container]');

      if (detachedContainer) {
        // In detached mode, scroll the detached container
        detachedContainer.scrollTop = detachedContainer.scrollHeight;
        requestAnimationFrame(() => {
          const isAtBottom = detachedContainer.scrollHeight - detachedContainer.scrollTop - detachedContainer.clientHeight < 10;
          if (!isAtBottom && remainingAttempts > 0) {
            setTimeout(() => attemptScroll(remainingAttempts - 1), 100);
          }
        });
      } else {
        // Normal mode, scroll the ScrollArea viewport
        const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
        if (viewport && viewport.scrollHeight > 0) {
          viewport.scrollTop = viewport.scrollHeight;
          requestAnimationFrame(() => {
            const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 10;
            if (!isAtBottom && remainingAttempts > 0) {
              setTimeout(() => attemptScroll(remainingAttempts - 1), 100);
            }
          });
        } else if (remainingAttempts > 0) {
          // Viewport not ready, retry
          setTimeout(() => attemptScroll(remainingAttempts - 1), 100);
        }
      }
    };
    attemptScroll(attempts);
  };

  // Load historical conversation
  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/tasks/${taskId}/conversation`);
      if (response.ok) {
        const data = await response.json();
        setHistoricalTurns(data.turns || []);
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [taskId]);

  // Auto-scroll to bottom when switching to a new task (after history loads)
  useEffect(() => {
    if (!isLoading) {
      // Use retry logic for better reliability in detached mode
      scrollToBottomWithRetry(5);
    }
  }, [taskId, isLoading]);

  // Refresh history when an attempt finishes
  useEffect(() => {
    if (lastIsRunning && !isRunning) {
      setTimeout(() => loadHistory(), 500);
    }
    setLastIsRunning(isRunning);
  }, [isRunning, lastIsRunning]);

  // Auto-scroll to bottom on new messages (only if user is near bottom)
  useEffect(() => {
    scrollToBottomIfNear();
  }, [currentMessages, historicalTurns, isRunning]);

  // Continuous auto-scroll during streaming
  // Uses requestAnimationFrame to smoothly scroll as content appears
  useEffect(() => {
    if (!isRunning) return;

    let rafId: number;

    const autoScroll = () => {
      scrollToBottomIfNear();
      rafId = requestAnimationFrame(autoScroll);
    };

    rafId = requestAnimationFrame(autoScroll);

    return () => cancelAnimationFrame(rafId);
  }, [isRunning]);

  const renderContentBlock = (
    block: ClaudeContentBlock,
    index: number,
    lastToolUseId: string | null,
    toolResultsMap: Map<string, { result: string; isError: boolean }>,
    isStreaming: boolean
  ) => {
    if (block.type === 'text' && block.text) {
      return <MessageBlock key={index} content={block.text} isStreaming={isStreaming} />;
    }

    if (block.type === 'thinking' && block.thinking) {
      return <MessageBlock key={index} content={block.thinking} isThinking isStreaming={isStreaming} />;
    }

    if (block.type === 'tool_use') {
      const toolId = block.id || '';
      const toolResult = toolResultsMap.get(toolId);
      const executing = isToolExecuting(toolId, lastToolUseId, toolResultsMap, isStreaming);

      return (
        <ToolUseBlock
          key={toolId || index}
          name={block.name || 'Unknown'}
          input={block.input}
          result={toolResult?.result}
          isError={toolResult?.isError}
          isStreaming={executing}
        />
      );
    }

    return null;
  };

  const renderMessage = (
    output: ClaudeOutput,
    index: number,
    isStreaming: boolean,
    allMessages: ClaudeOutput[]
  ) => {
    const toolResultsMap = buildToolResultsMap(allMessages);
    const lastToolUseId = findLastToolUseId(allMessages);

    // Handle assistant messages - render ALL content blocks in order (text, thinking, tool_use)
    // This preserves the natural order of Claude's response
    if (output.type === 'assistant' && output.message?.content) {
      const blocks = output.message.content;

      return (
        <div key={(output as any)._msgId || index} className="space-y-1 w-full max-w-full overflow-hidden">
          {blocks.map((block, blockIndex) =>
            renderContentBlock(block, blockIndex, lastToolUseId, toolResultsMap, isStreaming)
          )}
        </div>
      );
    }

    // Handle top-level tool_use messages (for CLIs that send tool use as separate JSON objects)
    if (output.type === 'tool_use') {
      const toolId = output.id || '';
      const toolResult = toolResultsMap.get(toolId);
      const isExecuting = isToolExecuting(toolId, lastToolUseId, toolResultsMap, isStreaming);

      return (
        <ToolUseBlock
          key={(output as any)._msgId || toolId || index}
          name={output.tool_name || 'Unknown'}
          input={output.tool_data}
          result={toolResult?.result}
          isError={toolResult?.isError}
          isStreaming={isExecuting}
        />
      );
    }

    // Skip tool_result, stream_event, user (tool results are matched via toolResultsMap)
    if (output.type === 'tool_result' || output.type === 'stream_event' || output.type === 'user') {
      return null;
    }

    return null;
  };

  // Check if file is an image
  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  };

  // User prompt - simple muted box with file thumbnails
  const renderUserTurn = (turn: ConversationTurn) => (
    <div key={`user-${turn.attemptId}`} className="bg-muted/40 rounded-lg px-4 py-3 text-[15px] leading-relaxed break-words space-y-3 w-full max-w-full overflow-hidden">
      <div>{turn.prompt}</div>
      {turn.files && turn.files.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {turn.files.map((file) => (
            isImage(file.mimeType) ? (
              <a
                key={file.id}
                href={`/api/uploads/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={`/api/uploads/${file.id}`}
                  alt={file.originalName}
                  className="h-16 w-auto rounded border border-border hover:border-primary transition-colors"
                  title={file.originalName}
                />
              </a>
            ) : (
              <a
                key={file.id}
                href={`/api/uploads/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-background rounded border border-border hover:border-primary transition-colors text-xs"
                title={file.originalName}
              >
                <FileText className="size-3" />
                <span className="max-w-[100px] truncate">{file.originalName}</span>
              </a>
            )
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <span className="text-xs text-muted-foreground">{formatTimestamp(turn.timestamp)}</span>
      </div>
    </div>
  );

  // Assistant response - clean text flow
  const renderAssistantTurn = (turn: ConversationTurn) => (
    <div key={`assistant-${turn.attemptId}`} className="space-y-4 w-full max-w-full overflow-hidden">
      {turn.messages.map((msg, idx) => renderMessage(msg, idx, false, turn.messages))}
    </div>
  );

  const renderTurn = (turn: ConversationTurn) => {
    if (turn.type === 'user') {
      return renderUserTurn(turn);
    }
    return renderAssistantTurn(turn);
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check empty state
  const hasHistory = historicalTurns.length > 0;
  const hasCurrentMessages = currentMessages.length > 0;
  const isEmpty = !hasHistory && !hasCurrentMessages && !isRunning;

  if (isEmpty) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-muted-foreground', className)}>
        <p className="text-sm">No conversation yet</p>
        <p className="text-xs mt-1">Start by sending a prompt below</p>
      </div>
    );
  }

  // Filter out currently running attempt from history to avoid duplication
  // When streaming, current messages should be shown from currentMessages, not history
  const filteredHistoricalTurns = currentAttemptId && isRunning
    ? historicalTurns.filter(t => t.attemptId !== currentAttemptId)
    : historicalTurns;

  return (
    <ScrollArea ref={scrollAreaRef} className={cn('h-full w-full max-w-full overflow-x-hidden', className)}>
      <div className="space-y-6 p-4 pb-24 w-full max-w-full overflow-x-hidden box-border">
        {/* Historical turns */}
        {filteredHistoricalTurns.map(renderTurn)}

        {/* Current streaming messages - only show if not already in filtered history */}
        {currentAttemptId && (currentMessages.length > 0 || isRunning) &&
          !filteredHistoricalTurns.some(t => t.attemptId === currentAttemptId && t.type === 'assistant') && (
            <>
              {/* User prompt if not in history */}
              {!filteredHistoricalTurns.some(t => t.attemptId === currentAttemptId && t.type === 'user') && currentPrompt && (
                <div className="bg-muted/40 rounded-lg px-4 py-3 text-[15px] leading-relaxed break-words space-y-3 w-full max-w-full overflow-hidden">
                  <div>{currentPrompt}</div>
                  {currentFiles && currentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {currentFiles.map((file) => {
                        // Use previewUrl (blob URL) for immediate display - it stays valid
                        // since we don't revoke it until page reload
                        const imgSrc = file.previewUrl;

                        return isImage(file.mimeType) ? (
                          <img
                            key={file.tempId}
                            src={imgSrc}
                            alt={file.originalName}
                            className="h-16 w-auto rounded border border-border"
                            title={file.originalName}
                          />
                        ) : (
                          <div
                            key={file.tempId}
                            className="flex items-center gap-1 px-2 py-1 bg-background rounded border border-border text-xs"
                            title={file.originalName}
                          >
                            <FileText className="size-3" />
                            <span className="max-w-[100px] truncate">{file.originalName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <span className="text-xs text-muted-foreground">{formatTimestamp(Date.now())}</span>
                  </div>
                </div>
              )}
              {/* Streaming response */}
              <div className="space-y-4 w-full max-w-full overflow-hidden">
                {currentMessages.map((msg, idx) => renderMessage(msg, idx, true, currentMessages))}
              </div>
            </>
          )}

        {/* Initial loading state - show until actual visible content appears */}
        {isRunning && !hasVisibleContent(currentMessages) &&
          !filteredHistoricalTurns.some(t => t.attemptId === currentAttemptId && t.type === 'assistant') && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-1">
              <RunningDots />
              <span className="font-mono text-[14px]" style={{ color: '#b9664a' }}>{statusVerb}...</span>
            </div>
          )}
      </div>
    </ScrollArea>
  );
}
