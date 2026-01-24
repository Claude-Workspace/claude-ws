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
  Copy,
  Check,
} from 'lucide-react';
import { RunningDots } from '@/components/ui/running-dots';
import { cn } from '@/lib/utils';
import { DiffView } from './diff-view';
import { Button } from '@/components/ui/button';

interface ToolUseBlockProps {
  name: string;
  input?: unknown;
  result?: string;
  isError?: boolean;
  isStreaming?: boolean;
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

// Get active verb for tool (for streaming status)
function getToolActiveVerb(name: string): string {
  const verbs: Record<string, string> = {
    Read: 'Reading',
    Write: 'Writing',
    Edit: 'Editing',
    Bash: 'Running',
    Grep: 'Searching',
    Glob: 'Finding',
    TodoWrite: 'Updating todos',
    WebFetch: 'Fetching',
    WebSearch: 'Searching web',
    Skill: 'Executing',
    Task: 'Delegating',
  };
  return verbs[name] || 'Processing';
}

// Get compact display text for tool
function getToolDisplay(name: string, input: any): string {
  if (!input) return name;

  switch (name) {
    case 'Read':
      return input.file_path || 'file...';
    case 'Write':
      return input.file_path || 'file...';
    case 'Edit':
      return input.file_path || 'file...';
    case 'Bash':
      return input.description || input.command?.slice(0, 80) || 'command...';
    case 'Grep':
      return `"${input.pattern || ''}"`;
    case 'Glob':
      return `${input.pattern || ''}`;
    case 'TodoWrite':
      if (input.todos && Array.isArray(input.todos)) {
        const inProgress = input.todos.filter((t: any) => t.status === 'in_progress');
        const pending = input.todos.filter((t: any) => t.status === 'pending');
        const completed = input.todos.filter((t: any) => t.status === 'completed');
        return `${completed.length}✓ ${inProgress.length}⟳ ${pending.length}○`;
      }
      return 'list';
    case 'Skill':
      return input.skill || 'unknown';
    case 'WebFetch':
      try {
        const url = new URL(input.url);
        return url.hostname + url.pathname.slice(0, 30);
      } catch {
        return input.url?.slice(0, 50) || 'url...';
      }
    case 'WebSearch':
      return `"${input.query || ''}"`;
    case 'Task':
      return input.description || 'task...';
    default:
      return name;
  }
}

// Get result summary for completed tool calls (like "Read 81 lines")
function getResultSummary(name: string, result?: string): string | null {
  if (!result) return null;

  switch (name) {
    case 'Read': {
      // Count lines from result (result is the file content)
      const lines = result.split('\n').length;
      return `${lines} lines`;
    }
    case 'Grep': {
      // Try to extract match count
      const matchCount = result.split('\n').filter(l => l.trim()).length;
      if (matchCount === 0) return 'no matches';
      return `${matchCount} match${matchCount !== 1 ? 'es' : ''}`;
    }
    case 'Glob': {
      // Count files found
      const files = result.split('\n').filter(l => l.trim()).length;
      if (files === 0) return 'no files';
      return `${files} file${files !== 1 ? 's' : ''}`;
    }
    case 'Task': {
      // Show completion status
      if (result.includes('completed')) return 'completed';
      return null;
    }
    case 'Write':
      return 'written';
    case 'Edit':
      return 'edited';
    default:
      return null;
  }
}

// Bash command block component
function BashBlock({ command, output, isError }: { command: string; output?: string; isError?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasOutput = output && output.trim().length > 0;
  const outputLines = output?.split('\n').length || 0;

  return (
    <div className="rounded-md border border-border overflow-hidden text-xs font-mono w-full max-w-full">
      {/* Command header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 bg-zinc-900 dark:bg-zinc-950 w-full max-w-full',
          hasOutput && 'cursor-pointer hover:bg-zinc-800 dark:hover:bg-zinc-900'
        )}
        onClick={() => hasOutput && setIsExpanded(!isExpanded)}
      >
        <Terminal className="size-3.5 text-zinc-400 shrink-0" />
        <code className="text-zinc-100 flex-1 truncate min-w-0">{command}</code>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            className="size-5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </Button>
          {hasOutput && (
            <span className="text-zinc-500 text-[10px]">
              {outputLines} line{outputLines !== 1 ? 's' : ''}
            </span>
          )}
          {hasOutput && (
            isExpanded ? (
              <ChevronDown className="size-3 text-zinc-500" />
            ) : (
              <ChevronRight className="size-3 text-zinc-500" />
            )
          )}
        </div>
      </div>

      {/* Output */}
      {isExpanded && hasOutput && (
        <div className={cn(
          'px-3 py-2 bg-zinc-950 dark:bg-black max-h-48 overflow-auto',
          isError && 'text-red-400'
        )}>
          <pre className="text-zinc-300 whitespace-pre-wrap break-all text-[11px] leading-relaxed">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

// Todo item interface
interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

// TodoWrite list display component
function TodoListBlock({ todos }: { todos: TodoItem[] }) {
  const completed = todos.filter(t => t.status === 'completed');
  const open = todos.filter(t => t.status !== 'completed');

  return (
    <div className="rounded-md border border-border overflow-hidden text-xs font-mono w-full max-w-full bg-zinc-900 dark:bg-zinc-950">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 text-zinc-400">
        Tasks ({completed.length} done, {open.length} open)
      </div>

      {/* Todo items */}
      <div className="px-3 py-2 space-y-1">
        {todos.map((todo, index) => {
          const isCompleted = todo.status === 'completed';
          const isInProgress = todo.status === 'in_progress';

          return (
            <div key={index} className="flex items-start gap-2">
              {/* Checkbox/status indicator */}
              <span className={cn(
                'shrink-0 w-4',
                isCompleted && 'text-green-500',
                isInProgress && 'text-yellow-500',
                !isCompleted && !isInProgress && 'text-zinc-500'
              )}>
                {isCompleted ? '✓' : isInProgress ? '⟳' : '☐'}
              </span>

              {/* Task number and content */}
              <span className={cn(
                'flex-1',
                isCompleted && 'text-zinc-500 line-through',
                isInProgress && 'text-zinc-100 font-medium',
                !isCompleted && !isInProgress && 'text-zinc-300'
              )}>
                <span className="text-zinc-500">#{index + 1}</span>{' '}
                {isInProgress ? (todo.activeForm || todo.content) : todo.content}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Edit tool diff display
function EditBlock({ input, result, isError }: { input: any; result?: string; isError?: boolean }) {
  if (!input?.old_string && !input?.new_string) {
    return null;
  }

  return (
    <DiffView
      oldText={input.old_string || ''}
      newText={input.new_string || ''}
      filePath={input.file_path}
    />
  );
}

export function ToolUseBlock({ name, input, result, isError, isStreaming, className }: ToolUseBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = getToolIcon(name);
  const displayText = getToolDisplay(name, input);
  const activeVerb = getToolActiveVerb(name);
  const resultSummary = getResultSummary(name, result);
  const inputObj = input as Record<string, unknown> | null | undefined;

  // Determine if we have special display modes
  const isBash = name === 'Bash';
  const isEdit = name === 'Edit';
  const isTodoWrite = name === 'TodoWrite';
  const hasEditDiff = isEdit && Boolean(inputObj?.old_string) && Boolean(inputObj?.new_string);
  const hasTodos = isTodoWrite && Array.isArray(inputObj?.todos) && (inputObj.todos as TodoItem[]).length > 0;

  // For bash, edit with diff, and todo list, we show expanded content differently
  const showSpecialView = isBash || hasEditDiff || hasTodos;

  // For other tools, check if we have expandable details
  const hasOtherDetails = !showSpecialView && Boolean(result || (inputObj && Object.keys(inputObj).length > 1));

  // Completed tool with result - show in green like CLI
  const isCompleted = !isStreaming && result && !isError;

  return (
    <div className={cn('group w-full max-w-full overflow-hidden my-2', className)}>
      {/* Main status line */}
      <div
        className={cn(
          'flex items-start gap-2.5 py-1.5 px-2 rounded-md transition-colors min-w-0 w-full max-w-full border border-transparent',
          isStreaming ? 'text-foreground bg-accent/30 border-accent/20' : 'text-muted-foreground hover:bg-accent/20',
          hasOtherDetails && 'cursor-pointer'
        )}
        onClick={() => hasOtherDetails && setIsExpanded(!isExpanded)}
      >
        {/* Completed indicator or expand/collapse */}
        {isCompleted && !hasOtherDetails ? (
          <span className="text-green-600 dark:text-green-500 shrink-0 mt-1">●</span>
        ) : hasOtherDetails ? (
          isExpanded ? (
            <ChevronDown className="size-3.5 shrink-0 mt-1" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 mt-1" />
          )
        ) : null}

        {/* Streaming spinner or icon */}
        {isStreaming ? (
          <RunningDots className="shrink-0" />
        ) : isCompleted ? null : (
          <Icon className={cn('size-4 shrink-0', isError && 'text-destructive')} />
        )}

        {/* Tool name and target - allow wrapping */}
        <span className={cn('font-mono text-[13.5px] leading-6 min-w-0 flex-1', isError && 'text-destructive')}>
          {isStreaming ? (
            <>
              {activeVerb} <span className="text-muted-foreground break-all">{displayText}</span>...
            </>
          ) : isCompleted ? (
            <>
              <span className="font-semibold text-foreground/90">{name}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-foreground/80 break-all">{displayText}</span>
              {/* Result summary inline after parens */}
              {resultSummary && (
                <span className="text-muted-foreground/60 text-xs ml-2">({resultSummary})</span>
              )}
            </>
          ) : (
            displayText
          )}
        </span>

        {/* Result summary for non-completed (streaming shows here) */}
        {resultSummary && !isStreaming && !isCompleted && (
          <span className="text-muted-foreground text-xs shrink-0 mt-1">
            ({resultSummary})
          </span>
        )}

        {isError && <AlertCircle className="size-3.5 text-destructive shrink-0 mt-1" />}
      </div>

      {/* Special view for Bash */}
      {isBash && Boolean(inputObj?.command) && (
        <div className="mt-1.5 ml-5 w-full max-w-full overflow-hidden pr-5">
          <BashBlock
            command={String(inputObj?.command)}
            output={result}
            isError={isError}
          />
        </div>
      )}

      {/* Special view for Edit with diff */}
      {hasEditDiff && (
        <div className="mt-1.5 ml-5 w-full max-w-full overflow-hidden pr-5">
          <EditBlock input={inputObj} result={result} isError={isError} />
        </div>
      )}

      {/* Special view for TodoWrite */}
      {hasTodos && (
        <div className="mt-1.5 ml-5 w-full max-w-full overflow-hidden pr-5">
          <TodoListBlock todos={inputObj?.todos as TodoItem[]} />
        </div>
      )}

      {/* Standard expandable details for other tools */}
      {isExpanded && hasOtherDetails && (
        <div className="ml-5 mt-1 pl-4 border-l border-border/50 text-[13px] text-muted-foreground space-y-2 w-full max-w-full overflow-hidden pr-5">
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
              {result.slice(0, 500)}
              {result.length > 500 && '...'}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
