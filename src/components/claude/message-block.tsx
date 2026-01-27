'use client';

import { useState, useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RunningDots } from '@/components/ui/running-dots';
import { cn } from '@/lib/utils';
import { CodeBlock } from './code-block';

interface MessageBlockProps {
  content: string;
  isThinking?: boolean;
  isStreaming?: boolean;
  className?: string;
}

// Memoized markdown components - defined outside component to avoid recreation
const markdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="text-lg font-semibold mt-6 mb-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-base font-semibold mt-5 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-[15px] font-semibold mt-4 mb-2 first:mt-0">{children}</h3>
  ),
  p: ({ children }: any) => (
    <p className="mb-4 last:mb-0 break-words">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside mb-4 space-y-1.5">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside mb-4 space-y-1.5">{children}</ol>
  ),
  li: ({ children }: any) => (
    <li className="text-[15px]">{children}</li>
  ),
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    let codeString = '';
    if (Array.isArray(children)) {
      codeString = children.map(child => (typeof child === 'string' ? child : '')).join('');
    } else if (typeof children === 'string') {
      codeString = children;
    } else if (children && typeof children === 'object' && 'props' in children) {
      codeString = String(children.props?.children || '');
    } else {
      codeString = String(children || '');
    }
    codeString = codeString.replace(/\n$/, '');
    const isMultiLine = codeString.includes('\n');
    if (!inline && (match || isMultiLine)) {
      return <CodeBlock code={codeString} language={match?.[1]} />;
    }
    return (
      <code className="px-1.5 py-0.5 bg-muted rounded text-[13px] font-mono" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => (
    <div className="my-2 w-full max-w-full overflow-x-auto">{children}</div>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold">{children}</strong>
  ),
  a: ({ href, children }: any) => (
    <a href={href} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border border-border px-2 py-1 bg-muted font-medium text-left">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="border border-border px-2 py-1">{children}</td>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

// Memoized markdown renderer - only re-renders when content changes
const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
});

// Main MessageBlock component - memoized to prevent unnecessary re-renders
export const MessageBlock = memo(function MessageBlock({
  content,
  isThinking = false,
  isStreaming = false,
  className
}: MessageBlockProps) {
  const [isExpanded, setIsExpanded] = useState(!isThinking);
  const [displayContent, setDisplayContent] = useState(content);
  const prevContentRef = useRef(content);
  const animatingRef = useRef(false);

  // Typewriter effect for streaming content - only for non-thinking blocks
  useEffect(() => {
    // Skip animation for thinking blocks or non-streaming
    if (isThinking || !isStreaming) {
      setDisplayContent(content);
      prevContentRef.current = content;
      return;
    }

    // If content shortened or same, show immediately
    if (content.length <= prevContentRef.current.length) {
      setDisplayContent(content);
      prevContentRef.current = content;
      return;
    }

    // New content added - animate typing
    const startFrom = displayContent.length;
    const targetLength = content.length;

    if (startFrom >= targetLength) {
      prevContentRef.current = content;
      return;
    }

    // Prevent overlapping animations
    if (animatingRef.current) return;
    animatingRef.current = true;

    let currentLength = startFrom;
    const charsPerFrame = 24; // Increased for better performance
    const frameInterval = 32; // Reduced frequency (30fps instead of 60fps)

    const timer = setInterval(() => {
      currentLength = Math.min(currentLength + charsPerFrame, targetLength);
      setDisplayContent(content.slice(0, currentLength));

      if (currentLength >= targetLength) {
        clearInterval(timer);
        animatingRef.current = false;
        prevContentRef.current = content;
      }
    }, frameInterval);

    return () => {
      clearInterval(timer);
      animatingRef.current = false;
    };
  }, [content, isThinking, isStreaming]);

  if (isThinking) {
    return (
      <div className={cn('', className)}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          <RunningDots />
          <span className="font-mono text-[14px]" style={{ color: '#b9664a' }}>Thinking...</span>
        </button>

        {isExpanded && (
          <div className="ml-5 mt-1 pl-4 border-l border-border/50 text-sm text-muted-foreground">
            <MarkdownContent content={content} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('text-[15px] leading-7 max-w-full w-full overflow-hidden', className)}>
      <MarkdownContent content={displayContent} />
    </div>
  );
});
