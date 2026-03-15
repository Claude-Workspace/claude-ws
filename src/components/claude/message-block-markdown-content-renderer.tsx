'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/components/claude/code-block';
import { MermaidDiagram } from '@/components/claude/mermaid-diagram';
import { ClickableFilePath } from '@/components/claude/clickable-file-path';
import { isValidFilePath } from '@/lib/file-path-detector';

// Memoized markdown component definitions - defined at module level to avoid recreation on each render
export const markdownComponents = {
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
      codeString = children.map((child: any) => (typeof child === 'string' ? child : '')).join('');
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
      if (match?.[1] === 'mermaid') {
        return <MermaidDiagram code={codeString} />;
      }
      return <CodeBlock code={codeString} language={match?.[1]} />;
    }

    // Inline code that looks like a file path becomes a clickable link
    if (inline && isValidFilePath(codeString)) {
      const lineMatch = codeString.match(/:(\d+)(?::(\d+))?$/);
      const filePath = lineMatch ? codeString.replace(/:(\d+)(?::(\d+))?$/, '') : codeString;
      const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
      const column = lineMatch?.[2] ? parseInt(lineMatch[2], 10) : undefined;

      return (
        <ClickableFilePath
          filePath={filePath}
          lineNumber={lineNumber}
          column={column}
          displayText={codeString}
        />
      );
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

/** Memoized markdown renderer — only re-renders when content string changes */
export const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
});
