'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Loader2, FileText, ArrowDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBlock } from '@/components/claude/message-block';
import { ToolUseBlock, extractTasksFromBlocks, ConsolidatedTaskListBlock } from '@/components/claude/tool-use-block';
import { RunningDots, useRandomStatusVerb } from '@/components/ui/running-dots';
import { PendingQuestionIndicator } from '@/components/task/pending-question-indicator';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ClaudeOutput, ClaudeContentBlock, AttemptFile, PendingFile } from '@/types';

interface ActiveQuestion {
  attemptId: string;
  toolUseId: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>;
}

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
  activeQuestion?: ActiveQuestion | null;
  onOpenQuestion?: () => void;
  className?: string;
  onHistoryLoaded?: (hasHistory: boolean) => void;
  // Refs from parent to track fetching state across remounts
  lastFetchedTaskIdRef?: React.RefObject<string | null>;
  isFetchingRef?: React.RefObject<boolean>;
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
  activeQuestion,
  onOpenQuestion,
  className,
  lastFetchedTaskIdRef,
  isFetchingRef,
}: ConversationViewProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [historicalTurns, setHistoricalTurns] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastIsRunning, setLastIsRunning] = useState(isRunning);
  const statusVerb = useRandomStatusVerb();
  // Track if user is manually scrolling (to pause auto-scroll)
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track last prompt to detect new prompt submission
  const lastPromptRef = useRef<string | undefined>(currentPrompt);
  // Use parent refs if provided, otherwise use local refs (fallback for backward compatibility)
  const localLastFetchedTaskIdRef = useRef<string | null>(null);
  const localIsFetchingRef = useRef(false);
  const effectiveLastFetchedRef = lastFetchedTaskIdRef || localLastFetchedTaskIdRef;
  const effectiveIsFetchingRef = isFetchingRef || localIsFetchingRef;
  // Track whether to show the scroll-to-bottom button
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Pre-compute tool results map and last tool ID for current messages (streaming)
  // Memoized to avoid O(n²) complexity on every render
  // MUST be called before any early returns per React Rules of Hooks
  const currentToolResultsMap = useMemo(
    () => buildToolResultsMap(currentMessages),
    [currentMessages]
  );
  const currentLastToolUseId = useMemo(
    () => findLastToolUseId(currentMessages),
    [currentMessages]
  );

  // Constants for scroll behavior
  const NEAR_BOTTOM_THRESHOLD = 150; // pixels from bottom to consider "near bottom"
  const SCROLL_RESET_DELAY = 500; // ms to wait before resetting scroll state (increased for mobile)

  // Get the active scroll container (detached window or normal viewport)
  const getScrollContainer = (): HTMLElement | null => {
    const detachedContainer = scrollAreaRef.current?.closest('[data-detached-scroll-container]') as HTMLElement | null;
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
    return detachedContainer || viewport;
  };

  // Check if user is near bottom of scroll area
  const isNearBottom = (): boolean => {
    const container = getScrollContainer();
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_THRESHOLD;
  };

  // Scroll to bottom only if user is near bottom
  const scrollToBottomIfNear = () => {
    if (isNearBottom()) {
      const container = getScrollContainer();
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  };

  // Force scroll to bottom (bypasses isNearBottom check)
  const scrollToBottom = () => {
    const container = getScrollContainer();
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  // Scroll to bottom with retry for reliability (especially in detached mode)
  const scrollToBottomWithRetry = (attempts = 3) => {
    const attemptScroll = (remainingAttempts: number) => {
      const container = getScrollContainer();
      if (!container) {
        if (remainingAttempts > 0) {
          setTimeout(() => attemptScroll(remainingAttempts - 1), 100);
        }
        return;
      }

      container.scrollTop = container.scrollHeight;
      requestAnimationFrame(() => {
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10;
        if (!isAtBottom && remainingAttempts > 0) {
          setTimeout(() => attemptScroll(remainingAttempts - 1), 100);
        }
      });
    };
    attemptScroll(attempts);
  };

  // Load historical conversation
  const loadHistory = async () => {
    // Prevent duplicate fetches for the same task ID
    if (effectiveLastFetchedRef.current === taskId && effectiveIsFetchingRef.current) {
      return;
    }

    if (effectiveIsFetchingRef.current) {
      return;
    }

    effectiveLastFetchedRef.current = taskId;
    effectiveIsFetchingRef.current = true;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/tasks/${taskId}/conversation`);
      if (response.ok) {
        const data = await response.json();
        setHistoricalTurns(data.turns || []);
      }
    } catch (error) {
      console.error('[ConversationView] Failed to load conversation history:', error);
    } finally {
      setIsLoading(false);
      effectiveIsFetchingRef.current = false;
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
      // Check scroll position after scroll completes
      setTimeout(() => {
        setShowScrollToBottom(!isNearBottom());
      }, 100);
    }
  }, [taskId, isLoading]);

  // Scroll to bottom when a new attempt starts (isRunning: false → true)
  // And refresh history when an attempt finishes (isRunning: true → false)
  useEffect(() => {
    if (!lastIsRunning && isRunning) {
      // New attempt started - scroll to bottom to show the new user prompt
      // Reset user scrolling flag so auto-scroll works during streaming
      userScrollingRef.current = false;

      // Use multiple delayed attempts to ensure DOM is fully rendered
      setTimeout(() => {
        scrollToBottomWithRetry(3);
      }, 50);

      setTimeout(() => {
        scrollToBottomWithRetry(3);
      }, 150);

      setTimeout(() => {
        scrollToBottomWithRetry(3);
      }, 300);
    } else if (lastIsRunning && !isRunning) {
      // Attempt finished - refresh history
      setTimeout(() => loadHistory(), 500);
    }
    setLastIsRunning(isRunning);
  }, [isRunning, lastIsRunning]);

  // Use MutationObserver to detect content changes and scroll to bottom
  // Throttled to prevent excessive scroll operations during streaming
  useEffect(() => {
    if (!isRunning) return;

    const container = getScrollContainer();
    const contentContainer = scrollAreaRef.current;

    if (!container || !contentContainer) return;

    // Throttle scroll operations to once per 100ms
    let scrollPending = false;
    let rafId: number | null = null;

    const performScroll = () => {
      // Only scroll if user is near bottom and not actively scrolling away
      if (!userScrollingRef.current && isNearBottom()) {
        container.scrollTop = container.scrollHeight;
      }
      scrollPending = false;
      rafId = null;
    };

    const observer = new MutationObserver(() => {
      // Only schedule scroll if not already pending
      if (!scrollPending) {
        scrollPending = true;
        rafId = requestAnimationFrame(performScroll);
      }
    });

    observer.observe(contentContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isRunning]);

  // Scroll to bottom when new prompt is submitted (currentPrompt changes to a new value)
  useEffect(() => {
    // Detect when prompt changes to a new non-empty value (indicating new user input)
    const promptChanged = currentPrompt && currentPrompt !== lastPromptRef.current;

    if (promptChanged) {
      // New prompt submitted - force scroll to bottom after DOM updates
      userScrollingRef.current = false;

      // Use multiple delayed attempts to ensure DOM is fully rendered
      setTimeout(() => scrollToBottomWithRetry(3), 50);
      setTimeout(() => scrollToBottomWithRetry(3), 150);
      setTimeout(() => scrollToBottomWithRetry(3), 300);
    }
    lastPromptRef.current = currentPrompt;
  }, [currentPrompt]);

  // Detect user scroll to pause auto-scroll and show/hide scroll-to-bottom button
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    let lastScrollTop = container.scrollTop;
    let scrollStartTime = Date.now();

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const scrollDirection = currentScrollTop > lastScrollTop ? 'down' : 'up';
      const now = Date.now();

      // Detect intentional user scroll (significant scroll up or sustained scrolling)
      const isScrollingUp = scrollDirection === 'up' && (lastScrollTop - currentScrollTop) > 5;
      const isSustainedScroll = (now - scrollStartTime) > 100;

      // Mark user as actively scrolling if they're scrolling up or scrolling intentionally
      if (isScrollingUp || isSustainedScroll) {
        userScrollingRef.current = true;
      }

      // Update last scroll position and time
      lastScrollTop = currentScrollTop;
      scrollStartTime = now;

      // Clear any pending reset
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }

      // Update button visibility based on scroll position
      const shouldShowButton = !isNearBottom();
      setShowScrollToBottom(shouldShowButton);

      // Schedule reset: re-enable auto-scroll when user settles at bottom
      userScrollTimeoutRef.current = setTimeout(() => {
        if (isNearBottom()) {
          userScrollingRef.current = false;
          setShowScrollToBottom(false);
        }
      }, SCROLL_RESET_DELAY);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, [isLoading]);

  // Auto-scroll to bottom on new messages (only if user is near bottom and not manually scrolling)
  useEffect(() => {
    if (!userScrollingRef.current) {
      scrollToBottomIfNear();
    }
  }, [currentMessages, historicalTurns, isRunning]);

  // Auto-scroll during streaming is now handled by the MutationObserver above
  // Removed continuous RAF loop which caused performance issues when switching tabs

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
          onOpenPanel={block.name === 'AskUserQuestion' ? onOpenQuestion : undefined}
        />
      );
    }

    return null;
  };

  const renderMessage = (
    output: ClaudeOutput,
    index: number,
    isStreaming: boolean,
    toolResultsMap: Map<string, { result: string; isError: boolean }>,
    lastToolUseId: string | null
  ) => {
    // Handle assistant messages - render ALL content blocks in order (text, thinking, tool_use)
    // Group consecutive TaskCreate/TaskUpdate blocks into a single consolidated todo list
    if (output.type === 'assistant' && output.message?.content) {
      const blocks = output.message.content;
      const renderedElements: React.ReactNode[] = [];
      let i = 0;

      while (i < blocks.length) {
        const block = blocks[i];
        const isTaskTool = block.type === 'tool_use' &&
          (block.name === 'TaskCreate' || block.name === 'TaskUpdate');

        if (isTaskTool) {
          // Collect consecutive task tool blocks
          const taskBlocks: { name: string; input: any; id?: string }[] = [];
          while (i < blocks.length) {
            const b = blocks[i];
            if (b.type === 'tool_use' && (b.name === 'TaskCreate' || b.name === 'TaskUpdate')) {
              taskBlocks.push({ name: b.name!, input: b.input, id: b.id });
              i++;
            } else {
              break;
            }
          }

          // Render consolidated task list
          const tasks = extractTasksFromBlocks(taskBlocks);
          if (tasks.length > 0) {
            // Show a single status line for the group, then the consolidated list
            const groupKey = taskBlocks.map(b => b.id).join('-') || `task-group-${renderedElements.length}`;
            renderedElements.push(
              <div key={groupKey} className="w-full max-w-full overflow-hidden">
                {/* Individual tool status lines (collapsed) */}
                {taskBlocks.map((tb, tbIdx) => {
                  const toolId = tb.id || '';
                  const toolResult = toolResultsMap.get(toolId);
                  const executing = isToolExecuting(toolId, lastToolUseId, toolResultsMap, isStreaming);
                  return (
                    <ToolUseBlock
                      key={toolId || `tb-${tbIdx}`}
                      name={tb.name}
                      input={tb.input}
                      result={toolResult?.result}
                      isError={toolResult?.isError}
                      isStreaming={executing}
                      hideTaskTodoList
                    />
                  );
                })}
                {/* Single consolidated task list */}
                <div className="mt-1.5 ml-5 w-full max-w-full overflow-hidden pr-5">
                  <ConsolidatedTaskListBlock tasks={tasks} />
                </div>
              </div>
            );
          }
        } else {
          // Render non-task blocks normally
          renderedElements.push(
            renderContentBlock(block, i, lastToolUseId, toolResultsMap, isStreaming)
          );
          i++;
        }
      }

      return (
        <div key={(output as any)._msgId || index} className="space-y-1 w-full max-w-full overflow-hidden">
          {renderedElements}
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
          onOpenPanel={output.tool_name === 'AskUserQuestion' ? onOpenQuestion : undefined}
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
    <div key={`user-${turn.attemptId}`} className="flex justify-end w-full max-w-full">
      <div className="bg-primary/10 rounded-lg px-4 py-3 text-[15px] leading-relaxed break-words space-y-3 max-w-[85%] overflow-hidden">
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
    </div>
  );

  // Render a list of messages with consecutive TaskCreate/TaskUpdate grouping
  const renderMessagesWithTaskGrouping = (
    messages: ClaudeOutput[],
    isStreaming: boolean,
    toolResultsMap: Map<string, { result: string; isError: boolean }>,
    lastToolUseId: string | null
  ): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < messages.length) {
      const msg = messages[i];
      const isTopLevelTaskTool = msg.type === 'tool_use' &&
        (msg.tool_name === 'TaskCreate' || msg.tool_name === 'TaskUpdate');

      if (isTopLevelTaskTool) {
        // Collect consecutive top-level TaskCreate/TaskUpdate messages
        const taskMsgs: ClaudeOutput[] = [];
        while (i < messages.length) {
          const m = messages[i];
          if (m.type === 'tool_use' && (m.tool_name === 'TaskCreate' || m.tool_name === 'TaskUpdate')) {
            taskMsgs.push(m);
            i++;
          } else {
            break;
          }
        }

        // Build task blocks for extraction
        const taskBlocks = taskMsgs.map(m => ({
          name: m.tool_name || 'TaskCreate',
          input: m.tool_data,
          id: m.id,
        }));
        const tasks = extractTasksFromBlocks(taskBlocks);
        const groupKey = taskBlocks.map(b => b.id).join('-') || `task-group-${elements.length}`;

        elements.push(
          <div key={groupKey} className="w-full max-w-full overflow-hidden">
            {/* Individual tool status lines (no JSON, no todo list) */}
            {taskMsgs.map((tm, tmIdx) => {
              const toolId = tm.id || '';
              const toolResult = toolResultsMap.get(toolId);
              const executing = isToolExecuting(toolId, lastToolUseId, toolResultsMap, isStreaming);
              return (
                <ToolUseBlock
                  key={toolId || `tm-${tmIdx}`}
                  name={tm.tool_name || 'TaskCreate'}
                  input={tm.tool_data}
                  result={toolResult?.result}
                  isError={toolResult?.isError}
                  isStreaming={executing}
                  hideTaskTodoList
                />
              );
            })}
            {/* Single consolidated task list */}
            {tasks.length > 0 && (
              <div className="mt-1.5 ml-5 w-full max-w-full overflow-hidden pr-5">
                <ConsolidatedTaskListBlock tasks={tasks} />
              </div>
            )}
          </div>
        );
      } else {
        elements.push(renderMessage(msg, i, isStreaming, toolResultsMap, lastToolUseId));
        i++;
      }
    }

    return elements;
  };

  // Assistant response - clean text flow
  // Pre-compute maps once per turn to avoid O(n²) complexity
  const renderAssistantTurn = (turn: ConversationTurn) => {
    const toolResultsMap = buildToolResultsMap(turn.messages);
    const lastToolUseId = findLastToolUseId(turn.messages);
    return (
      <div key={`assistant-${turn.attemptId}`} className="space-y-4 w-full max-w-full overflow-hidden">
        {renderMessagesWithTaskGrouping(turn.messages, false, toolResultsMap, lastToolUseId)}
      </div>
    );
  };

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
    <div className="relative h-full w-full max-w-full overflow-x-hidden">
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
                  <div className="flex justify-end w-full max-w-full">
                    <div className="bg-primary/10 rounded-lg px-4 py-3 text-[15px] leading-relaxed break-words space-y-3 max-w-[85%] overflow-hidden">
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
                  </div>
                )}
                {/* Streaming response */}
                <div className="space-y-4 w-full max-w-full overflow-hidden">
                  {renderMessagesWithTaskGrouping(currentMessages, true, currentToolResultsMap, currentLastToolUseId)}
                </div>

                {/* Pending question indicator - shown when question is interrupted */}
                {activeQuestion && onOpenQuestion && (
                  <PendingQuestionIndicator
                    questions={activeQuestion.questions}
                    onOpen={onOpenQuestion}
                  />
                )}
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

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <Button
          onClick={scrollToBottom}
          size="icon-lg"
          className="absolute bottom-6 right-6 rounded-full shadow-lg"
          aria-label="Scroll to bottom of conversation"
        >
          <ArrowDown className="h-5 w-5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
