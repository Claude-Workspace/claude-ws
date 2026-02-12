'use client';

import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { CodeBlock } from '@/components/claude/code-block';
import { ExternalLink, FileText, Folder } from 'lucide-react';

// Simple hash function for content comparison
function hashContent(content: string): number {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

interface MarkdownFileViewerProps {
  content: string;
  className?: string;
  /** Current file path (used to resolve relative links) */
  currentFilePath?: string;
  /** Base project path (for file sync) */
  basePath?: string | null;
  /** Callback when a local file link is clicked */
  onLocalFileClick?: (resolvedPath: string) => void;
}

/**
 * Check if a URL is an external/absolute URL (http, https, mailto, tel, etc.)
 * Returns true for external links, false for local file references
 */
function isExternalUrl(url: string): boolean {
  if (!url) return false;
  // Match common external protocols
  const externalProtocols = /^(https?:\/\/|mailto:|tel:|ftp:\/\/|file:\/\/|data:|javascript:|#)/i;
  return externalProtocols.test(url);
}

/**
 * Resolve a relative path from the current file's directory
 * @param currentFilePath - The path of the current markdown file
 * @param relativePath - The relative path from the link
 * @returns The resolved absolute path
 */
function resolveRelativePath(currentFilePath: string, relativePath: string): string {
  // Get the directory of the current file
  const lastSlashIndex = currentFilePath.lastIndexOf('/');
  const currentDir = lastSlashIndex >= 0 ? currentFilePath.substring(0, lastSlashIndex) : '';

  // Handle paths starting with ./
  if (relativePath.startsWith('./')) {
    relativePath = relativePath.substring(2);
  }

  // Split paths into segments
  const baseParts = currentDir.split('/').filter(Boolean);
  const relativeParts = relativePath.split('/').filter(Boolean);

  // Process each segment of the relative path
  for (const part of relativeParts) {
    if (part === '..') {
      // Go up one directory
      baseParts.pop();
    } else if (part !== '.') {
      // Add the segment
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

/**
 * Create markdown components with access to file link handling
 */
function createMarkdownComponents(
  currentFilePath: string | undefined,
  onLocalFileClick: ((resolvedPath: string) => void) | undefined
) {
  return {
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
    // Link component with local file handling
    a: ({ href, children }: any) => {
      const hrefString = href || '';

      // External links: open in new tab
      if (isExternalUrl(hrefString)) {
        return (
          <a
            href={hrefString}
            className="text-primary underline hover:no-underline inline-flex items-center gap-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
            <ExternalLink className="size-3 opacity-50" />
          </a>
        );
      }

      // Determine if path looks like a folder (ends with / or no extension)
      const hasExtension = hrefString.includes('.') && !hrefString.endsWith('/');
      const looksLikeFolder = hrefString.endsWith('/') || !hasExtension;
      const Icon = looksLikeFolder ? Folder : FileText;

      // Local file links: handle with callback or show as non-interactive
      if (currentFilePath && onLocalFileClick) {
        const resolvedPath = resolveRelativePath(currentFilePath, hrefString);
        return (
          <button
            type="button"
            onClick={() => onLocalFileClick(resolvedPath)}
            className="text-primary underline hover:no-underline cursor-pointer inline-flex items-center gap-1 bg-transparent border-none p-0 font-inherit text-inherit"
            title={looksLikeFolder ? `Navigate to ${resolvedPath}` : `Open ${resolvedPath}`}
          >
            <Icon className="size-3 opacity-50" />
            {children}
          </button>
        );
      }

      // Fallback: render as plain text with appropriate icon (no handler available)
      return (
        <span className="text-muted-foreground inline-flex items-center gap-1" title={hrefString}>
          <Icon className="size-3 opacity-50" />
          {children}
        </span>
      );
    },
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
}

/**
 * Cached Markdown Component
 * Uses a key-based cache to prevent re-parsing when content hasn't changed
 */
const CachedMarkdown = memo(function CachedMarkdown({
  content,
  components,
}: {
  content: string;
  components: ReturnType<typeof createMarkdownComponents>;
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}, (prevProps, nextProps) => {
  // Only re-render if content actually changed (use hash for comparison)
  return hashContent(prevProps.content) === hashContent(nextProps.content);
});

// Memoized markdown viewer for file content
// Custom comparison to avoid re-renders when only callback refs change
export const MarkdownFileViewer = memo(function MarkdownFileViewer({
  content,
  className,
  currentFilePath,
  basePath,
  onLocalFileClick
}: MarkdownFileViewerProps) {
  // Memoize markdown components to avoid recreating on every render
  const markdownComponents = useMemo(
    () => createMarkdownComponents(currentFilePath, onLocalFileClick),
    [currentFilePath, onLocalFileClick]
  );

  return (
    <div className={cn('h-full overflow-auto', className)}>
      <div className="max-w-4xl mx-auto px-6 py-8 prose-sm">
        <CachedMarkdown content={content} components={markdownComponents} />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if content or filePath changes
  // Ignore changes to callback refs (onLocalFileClick) to avoid unnecessary re-renders
  return (
    prevProps.content === nextProps.content &&
    prevProps.currentFilePath === nextProps.currentFilePath
  );
});
