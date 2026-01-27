'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { CodeBlock } from '@/components/claude/code-block';

interface MarkdownFileViewerProps {
  content: string;
  className?: string;
}

// Markdown rendering components optimized for file viewing
const markdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="text-2xl font-bold mt-8 mb-4 pb-2 border-b first:mt-0">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-xl font-semibold mt-6 mb-3 pb-1.5 border-b first:mt-0">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-lg font-semibold mt-5 mb-2 first:mt-0">{children}</h3>
  ),
  h4: ({ children }: any) => (
    <h4 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h4>
  ),
  p: ({ children }: any) => (
    <p className="mb-4 last:mb-0 leading-7">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-outside ml-6 mb-4 space-y-1.5">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-outside ml-6 mb-4 space-y-1.5">{children}</ol>
  ),
  li: ({ children }: any) => (
    <li className="leading-7">{children}</li>
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
      <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => (
    <div className="my-4 w-full max-w-full overflow-x-auto">{children}</div>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: any) => (
    <em className="italic">{children}</em>
  ),
  a: ({ href, children }: any) => (
    <a href={href} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-muted-foreground/30 pl-4 my-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full text-sm border-collapse border border-border">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-muted">{children}</thead>
  ),
  th: ({ children }: any) => (
    <th className="border border-border px-3 py-2 font-medium text-left">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="border border-border px-3 py-2">{children}</td>
  ),
  hr: () => <hr className="my-6 border-border" />,
  img: ({ src, alt }: any) => (
    <img src={src} alt={alt || ''} className="max-w-full h-auto my-4 rounded-lg" />
  ),
  // Task list items (GFM)
  input: ({ checked, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      disabled
      className="mr-2 pointer-events-none"
      {...props}
    />
  ),
};

// Memoized markdown viewer for file content
export const MarkdownFileViewer = memo(function MarkdownFileViewer({
  content,
  className
}: MarkdownFileViewerProps) {
  return (
    <div className={cn('h-full overflow-auto', className)}>
      <div className="max-w-4xl mx-auto px-6 py-8 prose-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
});
