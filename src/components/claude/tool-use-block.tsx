'use client';

import { useState } from 'react';
import {
  FileText,
  FilePlus,
  FileEdit,
  Terminal,
  Search,
  FolderSearch,
  CheckSquare,
  Globe,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolUseBlockProps {
  name: string;
  input?: unknown;
  result?: string;
  isError?: boolean;
  className?: string;
}

// Get icon for tool type
function getToolIcon(name: string) {
  const icons: Record<string, typeof FileText> = {
    Read: FileText,
    Write: FilePlus,
    Edit: FileEdit,
    Bash: Terminal,
    Grep: Search,
    Glob: FolderSearch,
    TodoWrite: CheckSquare,
    WebFetch: Globe,
    WebSearch: Globe,
    Skill: Zap,
  };
  return icons[name] || FileText;
}

// Get compact display text for tool
function getToolDisplay(name: string, input: any): string {
  if (!input) return name;

  switch (name) {
    case 'Read':
      return input.file_path || 'Reading file...';
    case 'Write':
      return input.file_path || 'Writing file...';
    case 'Edit':
      return input.file_path || 'Editing file...';
    case 'Bash':
      return input.description || input.command?.slice(0, 60) || 'Running command...';
    case 'Grep':
      return `Search: ${input.pattern || ''}`;
    case 'Glob':
      return `Find: ${input.pattern || ''}`;
    case 'TodoWrite':
      // Show summary of todo items
      if (input.todos && Array.isArray(input.todos)) {
        const inProgress = input.todos.filter((t: any) => t.status === 'in_progress');
        const pending = input.todos.filter((t: any) => t.status === 'pending');
        const completed = input.todos.filter((t: any) => t.status === 'completed');
        return `TODO: ${completed.length}✓ ${inProgress.length}⟳ ${pending.length}○`;
      }
      return 'TODO list updated';
    case 'Skill':
      // Show which skill is being used
      return `Skill: ${input.skill || 'unknown'}`;
    case 'WebFetch':
      return input.url || 'Fetching...';
    case 'WebSearch':
      return `Search: ${input.query || ''}`;
    default:
      return name;
  }
}

export function ToolUseBlock({ name, input, result, isError, className }: ToolUseBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = getToolIcon(name);
  const displayText = getToolDisplay(name, input);
  const inputObj = input as Record<string, unknown> | null | undefined;
  const hasDetails = result || (inputObj && Object.keys(inputObj).length > 1);

  // Simple inline display for most tools
  return (
    <div className={cn('group max-w-full overflow-hidden', className)}>
      <div
        className={cn(
          'flex items-center gap-2 py-1 text-sm text-muted-foreground min-w-0',
          hasDetails && 'cursor-pointer hover:text-foreground'
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        {hasDetails && (
          isExpanded ? (
            <ChevronDown className="size-3 shrink-0" />
          ) : (
            <ChevronRight className="size-3 shrink-0" />
          )
        )}
        <Icon className={cn('size-4 shrink-0', isError && 'text-destructive')} />
        <span className={cn('font-mono text-[13px] truncate min-w-0', isError && 'text-destructive')}>
          {displayText}
        </span>
        {isError && <AlertCircle className="size-3 text-destructive shrink-0" />}
      </div>

      {/* Expandable details */}
      {isExpanded && hasDetails && (
        <div className="ml-5 mt-1 pl-4 border-l border-border/50 text-xs text-muted-foreground space-y-2 max-w-full overflow-hidden">
          {inputObj && Object.keys(inputObj).length > 1 && (
            <pre className="font-mono bg-muted/30 p-2 rounded overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
              {JSON.stringify(inputObj, null, 2)}
            </pre>
          )}
          {result && (
            <pre className={cn(
              'font-mono bg-muted/30 p-2 rounded overflow-x-auto max-h-40 whitespace-pre-wrap break-all',
              isError && 'text-destructive'
            )}>
              {result.slice(0, 300)}
              {result.length > 300 && '...'}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
