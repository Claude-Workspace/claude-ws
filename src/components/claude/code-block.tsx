'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('relative group rounded-md overflow-hidden border border-border w-full max-w-full', className)}>
      {/* Header with language label and copy button */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border w-full">
        <span className="text-xs font-mono text-muted-foreground">
          {language || 'text'}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          {copied ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
        </Button>
      </div>
      <pre className="p-3 bg-muted/30 text-[13px] leading-relaxed whitespace-pre-wrap break-words font-mono w-full max-w-full overflow-x-auto">
        <code className={language ? `language-${language}` : ''}>{code}</code>
      </pre>
    </div>
  );
}
