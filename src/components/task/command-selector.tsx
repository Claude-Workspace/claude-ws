'use client';

import { useState, useEffect, useRef } from 'react';
import { Command, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandInfo {
  name: string;
  description: string;
  argumentHint?: string;
  hasSubcommands: boolean;
  subcommands?: string[];
}

interface CommandSelectorProps {
  isOpen: boolean;
  onSelect: (command: string, subcommand?: string) => void;
  onClose: () => void;
  filter?: string;
  className?: string;
}

export function CommandSelector({
  isOpen,
  onSelect,
  onClose,
  filter = '',
  className,
}: CommandSelectorProps) {
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch commands
  useEffect(() => {
    async function fetchCommands() {
      try {
        const res = await fetch('/api/commands');
        if (res.ok) {
          const data = await res.json();
          setCommands(data);
        }
      } catch (error) {
        console.error('Failed to fetch commands:', error);
      } finally {
        setLoading(false);
      }
    }

    if (isOpen) {
      fetchCommands();
    }
  }, [isOpen]);

  // Filter commands based on input
  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          if (selected.hasSubcommands && !expandedCommand) {
            setExpandedCommand(selected.name);
          } else {
            onSelect(expandedCommand || selected.name);
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (expandedCommand) {
          setExpandedCommand(null);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight') {
        const selected = filteredCommands[selectedIndex];
        if (selected?.hasSubcommands) {
          e.preventDefault();
          setExpandedCommand(selected.name);
        }
      } else if (e.key === 'ArrowLeft' && expandedCommand) {
        e.preventDefault();
        setExpandedCommand(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, expandedCommand, onSelect, onClose]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
    setExpandedCommand(null);
  }, [filter]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedEl = list.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Show subcommands if a command is expanded
  const expandedCmd = expandedCommand
    ? commands.find((c) => c.name === expandedCommand)
    : null;

  return (
    <div
      className={cn(
        'absolute bottom-full left-0 mb-2 w-full max-w-md bg-popover border rounded-lg shadow-lg overflow-hidden z-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
        <Command className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {expandedCommand ? `/${expandedCommand}` : 'Commands'}
        </span>
        {expandedCommand && (
          <button
            onClick={() => setExpandedCommand(null)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Command list */}
      <div ref={listRef} className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading commands...
          </div>
        ) : expandedCmd ? (
          // Subcommands
          expandedCmd.subcommands?.map((sub, index) => (
            <button
              key={sub}
              onClick={() => onSelect(expandedCommand!, sub)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors',
                index === selectedIndex && 'bg-muted'
              )}
            >
              <Zap className="size-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">/{expandedCommand}:{sub}</div>
              </div>
            </button>
          ))
        ) : filteredCommands.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No commands found
          </div>
        ) : (
          filteredCommands.map((cmd, index) => (
            <button
              key={cmd.name}
              onClick={() => {
                if (cmd.hasSubcommands) {
                  setExpandedCommand(cmd.name);
                } else {
                  onSelect(cmd.name);
                }
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors',
                index === selectedIndex && 'bg-muted'
              )}
            >
              <Zap className="size-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">/{cmd.name}</span>
                  {cmd.argumentHint && (
                    <span className="text-xs text-muted-foreground">{cmd.argumentHint}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
              </div>
              {cmd.hasSubcommands && (
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
        <kbd className="px-1 bg-muted rounded">↑↓</kbd> navigate
        <span className="mx-2">·</span>
        <kbd className="px-1 bg-muted rounded">Enter</kbd> select
        <span className="mx-2">·</span>
        <kbd className="px-1 bg-muted rounded">Esc</kbd> close
      </div>
    </div>
  );
}
