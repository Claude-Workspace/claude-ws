'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Command } from 'lucide-react';
import { CommandSelector } from './command-selector';
import { cn } from '@/lib/utils';

interface PromptInputProps {
  onSubmit: (prompt: string, displayPrompt?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function PromptInput({
  onSubmit,
  disabled = false,
  placeholder = 'Describe what you want Claude to do... (type / for commands)',
  className,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<{ name: string; subcommand?: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect slash command input
  useEffect(() => {
    if (prompt.startsWith('/') && !selectedCommand) {
      setShowCommands(true);
      // Extract filter text after /
      const filter = prompt.slice(1).split(' ')[0];
      setCommandFilter(filter);
    } else if (!prompt.startsWith('/')) {
      setShowCommands(false);
      setCommandFilter('');
    }
  }, [prompt, selectedCommand]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || disabled) return;

    const originalPrompt = prompt.trim();
    let finalPrompt = originalPrompt;
    let displayPrompt: string | undefined;

    // If it's a command, process it
    if (selectedCommand || prompt.startsWith('/')) {
      const match = prompt.match(/^\/(\w+)(?::(\w+))?\s*(.*)/);
      if (match) {
        const [, cmdName, subCmd, args] = match;
        // Store original command as display prompt
        displayPrompt = originalPrompt;
        try {
          const res = await fetch(`/api/commands/${cmdName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subcommand: subCmd,
              arguments: args.trim(),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            finalPrompt = data.prompt;
          }
        } catch (error) {
          console.error('Failed to process command:', error);
        }
      }
    }

    onSubmit(finalPrompt, displayPrompt);
    setPrompt('');
    setSelectedCommand(null);
    setShowCommands(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't handle if command selector is open (it handles its own keys)
    if (showCommands && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
      return;
    }

    // Submit on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as any);
    }

    // Close command selector on Escape
    if (e.key === 'Escape' && showCommands) {
      e.preventDefault();
      setShowCommands(false);
      setPrompt('');
    }
  };

  const handleCommandSelect = (command: string, subcommand?: string) => {
    const cmdText = subcommand ? `/${command}:${subcommand} ` : `/${command} `;
    setPrompt(cmdText);
    setSelectedCommand({ name: command, subcommand });
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  const handleCommandClose = () => {
    setShowCommands(false);
    if (prompt === '/' || prompt.startsWith('/') && !prompt.includes(' ')) {
      setPrompt('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('relative flex flex-col gap-2', className)}>
      {/* Command Selector */}
      <CommandSelector
        isOpen={showCommands}
        onSelect={handleCommandSelect}
        onClose={handleCommandClose}
        filter={commandFilter}
      />

      {/* Input area */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'min-h-24 resize-none pr-10',
            selectedCommand && 'border-primary'
          )}
        />
        {/* Command indicator */}
        {selectedCommand && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              <Command className="size-3" />
              {selectedCommand.subcommand
                ? `${selectedCommand.name}:${selectedCommand.subcommand}`
                : selectedCommand.name}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Type <kbd className="px-1 bg-muted rounded">/</kbd> for commands
          <span className="mx-2">·</span>
          <kbd className="px-1 bg-muted rounded">{typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd className="px-1 bg-muted rounded">Enter</kbd> to send
        </p>
        <Button type="submit" disabled={disabled || !prompt.trim()} size="sm">
          {disabled ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Send className="size-4" />
              Send
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
