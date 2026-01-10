'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBlock } from '@/components/claude/message-block';
import { ToolUseBlock } from '@/components/claude/tool-use-block';
import { cn } from '@/lib/utils';
import type { ClaudeOutput, ClaudeContentBlock } from '@/types';

interface ConversationTurn {
  type: 'user' | 'assistant';
  prompt?: string;
  messages: ClaudeOutput[];
  attemptId: string;
  timestamp: number;
}

interface ConversationViewProps {
  taskId: string;
  currentMessages: ClaudeOutput[];
  currentAttemptId: string | null;
  currentPrompt?: string;
  isRunning: boolean;
  className?: string;
}

export function ConversationView({
  taskId,
  currentMessages,
  currentAttemptId,
  currentPrompt,
  isRunning,
  className,
}: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [historicalTurns, setHistoricalTurns] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastIsRunning, setLastIsRunning] = useState(isRunning);

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, historicalTurns]);

  const renderContentBlock = (block: ClaudeContentBlock, index: number) => {
    if (block.type === 'text' && block.text) {
      return <MessageBlock key={index} content={block.text} />;
    }

    if (block.type === 'thinking' && block.thinking) {
      return <MessageBlock key={index} content={block.thinking} isThinking />;
    }

    if (block.type === 'tool_use') {
      return (
        <ToolUseBlock
          key={index}
          name={block.name || 'Unknown'}
          input={block.input}
        />
      );
    }

    return null;
  };

  const renderMessage = (output: ClaudeOutput, index: number, isStreaming: boolean) => {
    // Handle assistant messages with content blocks
    if (output.type === 'assistant' && output.message?.content) {
      return (
        <div key={index} className="space-y-1 max-w-full overflow-hidden">
          {output.message.content.map((block, blockIndex) =>
            renderContentBlock(block, blockIndex)
          )}
        </div>
      );
    }

    // Skip all other event types during streaming since they're duplicates
    // of content that will appear in assistant messages
    if (output.type === 'tool_use' || output.type === 'tool_result' || output.type === 'stream_event') {
      return null;
    }

    return null;
  };

  // User prompt - simple muted box
  const renderUserTurn = (turn: ConversationTurn) => (
    <div key={`user-${turn.attemptId}`} className="bg-muted/50 rounded px-3 py-2 text-sm break-words">
      {turn.prompt}
    </div>
  );

  // Assistant response - clean text flow
  const renderAssistantTurn = (turn: ConversationTurn) => (
    <div key={`assistant-${turn.attemptId}`} className="space-y-1 max-w-full overflow-hidden">
      {turn.messages.map((msg, idx) => renderMessage(msg, idx, false))}
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
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-3 p-4 max-w-full overflow-hidden">
        {/* Historical turns */}
        {historicalTurns.map(renderTurn)}

        {/* Current streaming messages */}
        {currentAttemptId && (currentMessages.length > 0 || isRunning) && (
          <>
            {/* User prompt if not in history */}
            {!historicalTurns.some(t => t.attemptId === currentAttemptId && t.type === 'user') && currentPrompt && (
              <div className="bg-muted/50 rounded px-3 py-2 text-sm">
                {currentPrompt}
              </div>
            )}
            {/* Streaming response */}
            <div className="space-y-1 max-w-full overflow-hidden">
              {currentMessages.map((msg, idx) => renderMessage(msg, idx, true))}
              {isRunning && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Generating...</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Initial loading state */}
        {isRunning && currentMessages.length === 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-3 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
