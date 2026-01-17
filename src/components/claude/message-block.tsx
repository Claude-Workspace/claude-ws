'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { RunningDots } from '@/components/ui/running-dots';
import { cn } from '@/lib/utils';
import { CodeBlock } from './code-block';
import 'highlight.js/styles/github-dark.css';

interface MessageBlockProps {
  content: string;
  isThinking?: boolean;
  isStreaming?: boolean;
  className?: string;
}

export function MessageBlock({ content, isThinking = false, isStreaming = false, className }: MessageBlockProps) {
  const [isExpanded, setIsExpanded] = useState(!isThinking);
  const [displayContent, setDisplayContent] = useState(content);
  const prevContentRef = useRef(content);
  const animatingRef = useRef(false);

  // Typewriter effect for streaming content
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
    const charsPerFrame = 12; // Speed: characters per frame
    const frameInterval = 16; // ~60fps

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
          <RunningDots className="text-primary" />
          <span className="font-mono text-[14px]">Thinking...</span>
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
    <div className={cn('text-[15px] leading-7 max-w-full overflow-hidden', className)}>
      <MarkdownContent content={displayContent} />
    </div>
  );
}

// Separate component for markdown rendering with consistent styling
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // Headings - consistent sizing, not too big
        h1: ({ children }) => (
          <h1 className="text-lg font-semibold mt-6 mb-3 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold mt-5 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-[15px] font-semibold mt-4 mb-2 first:mt-0">{children}</h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="mb-4 last:mb-0 break-words">{children}</p>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-4 space-y-1.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-4 space-y-1.5">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-[15px]">{children}</li>
        ),
        // Code
        code({ inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');

          // Extract code string from children (handle React nodes properly)
          let codeString = '';
          if (Array.isArray(children)) {
            codeString = children
              .map(child => (typeof child === 'string' ? child : ''))
              .join('');
          } else if (typeof children === 'string') {
            codeString = children;
          } else if (children && typeof children === 'object' && 'props' in children) {
            // Handle React element nodes
            codeString = String(children.props?.children || '');
          } else {
            codeString = String(children || '');
          }

          // Remove trailing newline
          codeString = codeString.replace(/\n$/, '');

          // Only use CodeBlock for actual code blocks (has language OR has multiple lines)
          const isMultiLine = codeString.includes('\n');
          if (!inline && (match || isMultiLine)) {
            return <CodeBlock code={codeString} language={match?.[1]} />;
          }

          // Inline code (single line without language specification)
          return (
            <code
              className="px-1.5 py-0.5 bg-muted rounded text-[13px] font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        // Pre blocks
        pre: ({ children }) => (
          <div className="my-2 overflow-x-auto">{children}</div>
        ),
        // Strong/Bold
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-primary underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border px-2 py-1 bg-muted font-medium text-left">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-2 py-1">{children}</td>
        ),
        // Horizontal rule
        hr: () => <hr className="my-3 border-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
