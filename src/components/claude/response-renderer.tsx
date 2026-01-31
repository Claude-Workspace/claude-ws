'use client';

import { useEffect, useRef } from 'react';
import type { ClaudeOutput, ClaudeContentBlock } from '@/types';
import { MessageBlock } from './message-block';
import { ToolUseBlock, extractTasksFromBlocks, ConsolidatedTaskListBlock } from './tool-use-block';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ResponseRendererProps {
  messages: ClaudeOutput[];
  className?: string;
}

export function ResponseRenderer({ messages, className }: ResponseRendererProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is near bottom
  const isNearBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (!viewport) return true;
    const threshold = 150;
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold;
  };

  // Detect user scroll to pause auto-scroll
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;

    const handleScroll = () => {
      userScrollingRef.current = true;
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      userScrollTimeoutRef.current = setTimeout(() => {
        if (isNearBottom()) {
          userScrollingRef.current = false;
        }
      }, 150);
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll to bottom on new messages (only if not manually scrolling)
  useEffect(() => {
    if (!userScrollingRef.current && isNearBottom()) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

    if (block.type === 'tool_result') {
      // Tool results are typically shown inline with tool_use
      return null;
    }

    return null;
  };

  const renderMessage = (output: ClaudeOutput, index: number) => {
    // Handle assistant messages with content blocks
    if (output.type === 'assistant' && output.message?.content) {
      return (
        <div key={index} className="space-y-4">
          {output.message.content.map((block, blockIndex) =>
            renderContentBlock(block, blockIndex)
          )}
        </div>
      );
    }

    // Handle tool use events
    if (output.type === 'tool_use' && output.tool_name) {
      return (
        <ToolUseBlock
          key={index}
          name={output.tool_name}
          input={output.tool_data}
        />
      );
    }

    // Handle tool results
    if (output.type === 'tool_result' && output.result) {
      return (
        <ToolUseBlock
          key={index}
          name={output.tool_name || 'Tool'}
          result={output.result}
          isError={output.is_error}
        />
      );
    }

    // Handle stream events with delta text
    if (output.type === 'stream_event' && output.event?.delta?.text) {
      return (
        <div key={index} className="text-sm text-foreground/80">
          {output.event.delta.text}
        </div>
      );
    }

    return null;
  };

  if (messages.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full text-muted-foreground', className)}>
        <p className="text-sm">No messages yet. Start by sending a prompt.</p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className={cn('h-full', className)}>
      <div className="space-y-4 p-4">
        {messages.map((message, index) => renderMessage(message, index))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
