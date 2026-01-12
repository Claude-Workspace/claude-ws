'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBlock } from '@/components/claude/message-block';
import { ToolUseBlock } from '@/components/claude/tool-use-block';
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

// Find if this is the last tool_use in the message stream (still executing)
function isToolExecuting(
  toolId: string,
  allBlocks: ClaudeContentBlock[],
  toolResultsMap: Map<string, { result: string; isError: boolean }>,
  isStreaming: boolean
): boolean {
  if (!isStreaming) return false;
  // If we have a result, it's not executing
  if (toolResultsMap.has(toolId)) return false;
  // Find if this is the last tool_use block
  const toolUseBlocks = allBlocks.filter(b => b.type === 'tool_use');
  const lastToolUse = toolUseBlocks[toolUseBlocks.length - 1];
  return lastToolUse?.id === toolId;
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

  // Scroll to bottom of scroll area viewport
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
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

  // Refresh history when an attempt finishes
  useEffect(() => {
    if (lastIsRunning && !isRunning) {
      setTimeout(() => loadHistory(), 500);
    }
    setLastIsRunning(isRunning);
  }, [isRunning, lastIsRunning]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, historicalTurns, isRunning]);

  const renderContentBlock = (
    block: ClaudeContentBlock,
    index: number,
    allBlocks: ClaudeContentBlock[],
    toolResultsMap: Map<string, { result: string; isError: boolean }>,
    isStreaming: boolean
  ) => {
    if (block.type === 'text' && block.text) {
      return <MessageBlock key={index} content={block.text} />;
    }

    if (block.type === 'thinking' && block.thinking) {
      return <MessageBlock key={index} content={block.thinking} isThinking />;
    }

    if (block.type === 'tool_use') {
      const toolId = block.id || '';
      const toolResult = toolResultsMap.get(toolId);
      const executing = isToolExecuting(toolId, allBlocks, toolResultsMap, isStreaming);

      return (
        <ToolUseBlock
          key={index}
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

    // Handle assistant messages - render ALL content blocks in order (text, thinking, tool_use)
    // This preserves the natural order of Claude's response
    if (output.type === 'assistant' && output.message?.content) {
      const blocks = output.message.content;

      return (
        <div key={index} className="space-y-1 max-w-full overflow-hidden">
          {blocks.map((block, blockIndex) =>
            renderContentBlock(block, blockIndex, blocks, toolResultsMap, isStreaming)
          )}
        </div>
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

  // User prompt - simple muted box with file thumbnails
  const renderUserTurn = (turn: ConversationTurn) => (
    <div key={`user-${turn.attemptId}`} className="bg-muted/50 rounded px-3 py-2 text-sm break-words space-y-2">
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
    </div>
  );

  // Assistant response - clean text flow
  const renderAssistantTurn = (turn: ConversationTurn) => (
    <div key={`assistant-${turn.attemptId}`} className="space-y-1 max-w-full overflow-hidden">
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

  return (
    <ScrollArea ref={scrollAreaRef} className={cn('h-full', className)}>
      <div className="space-y-3 p-4 pb-24 max-w-full overflow-hidden">
        {/* Historical turns */}
        {historicalTurns.map(renderTurn)}

        {/* Current streaming messages - only show if not already in history */}
        {currentAttemptId && (currentMessages.length > 0 || isRunning) &&
         !historicalTurns.some(t => t.attemptId === currentAttemptId && t.type === 'assistant') && (
          <>
            {/* User prompt if not in history */}
            {!historicalTurns.some(t => t.attemptId === currentAttemptId && t.type === 'user') && currentPrompt && (
              <div className="bg-muted/50 rounded px-3 py-2 text-sm break-words space-y-2">
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
              </div>
            )}
            {/* Streaming response */}
            <div className="space-y-1 max-w-full overflow-hidden">
              {currentMessages.map((msg, idx) => renderMessage(msg, idx, true, currentMessages))}
            </div>
          </>
        )}

        {/* Initial loading state - only show when waiting for first response */}
        {isRunning && currentMessages.length === 0 &&
         !historicalTurns.some(t => t.attemptId === currentAttemptId && t.type === 'assistant') && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-1">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span className="font-mono text-[13px]">Thinking...</span>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
