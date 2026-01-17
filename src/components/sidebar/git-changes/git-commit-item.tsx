'use client';

import { cn } from '@/lib/utils';

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  refs: string[];
  isLocal?: boolean;
  isMerge?: boolean;
}

interface GitCommitItemProps {
  commit: GitCommit;
  isHead: boolean;
  color: string;
  isMerge: boolean;
  showLine: boolean;
  onClick?: () => void;
}

// Parse refs to extract branch/tag names
function parseRefs(refs: string[]): { branches: string[]; tags: string[] } {
  const branches: string[] = [];
  const tags: string[] = [];

  for (const ref of refs) {
    if (ref.startsWith('HEAD -> ')) {
      branches.push(ref.replace('HEAD -> ', ''));
    } else if (ref.startsWith('tag: ')) {
      tags.push(ref.replace('tag: ', ''));
    } else if (ref.includes('/')) {
      // Remote branch like origin/main
      branches.push(ref.split('/').pop() || ref);
    } else {
      branches.push(ref);
    }
  }

  // Deduplicate
  return {
    branches: [...new Set(branches)],
    tags: [...new Set(tags)],
  };
}

// Parse conventional commit message to highlight prefix
function parseCommitMessage(message: string): { prefix: string | null; scope: string | null; subject: string } {
  const conventionalCommitRegex = /^(feat|fix|docs|refactor|chore|style|test|perf|ci|build|revert)(\(.+?\))?:\s*(.+)$/;
  const match = message.match(conventionalCommitRegex);

  if (match) {
    return {
      prefix: match[1],
      scope: match[2] || null,
      subject: match[3],
    };
  }

  return {
    prefix: null,
    scope: null,
    subject: message,
  };
}

// Get color for conventional commit type
function getCommitTypeColor(type: string): string {
  const colors: Record<string, string> = {
    feat: 'text-green-400',
    fix: 'text-red-400',
    docs: 'text-blue-400',
    refactor: 'text-purple-400',
    chore: 'text-gray-400',
    style: 'text-pink-400',
    test: 'text-yellow-400',
    perf: 'text-orange-400',
    ci: 'text-cyan-400',
    build: 'text-indigo-400',
    revert: 'text-red-400',
  };
  return colors[type] || 'text-muted-foreground';
}

export function GitCommitItem({
  commit,
  isHead,
  color,
  isMerge,
  showLine,
  onClick,
}: GitCommitItemProps) {
  const { branches, tags } = parseRefs(commit.refs);
  const { prefix, scope, subject } = parseCommitMessage(commit.message);

  return (
    <div
      className="flex-1 min-w-0 px-2 hover:bg-accent/30 cursor-pointer group flex items-center"
      style={{ minHeight: '28px' }}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 flex-wrap flex-1">
        <span className="text-sm truncate flex-1 min-w-0 leading-[28px]">
          {prefix && (
            <>
              <span className={cn('font-semibold', getCommitTypeColor(prefix))}>
                {prefix}
              </span>
              {scope && (
                <span className="text-muted-foreground/70">{scope}</span>
              )}
              <span className="text-muted-foreground">: </span>
            </>
          )}
          <span>{subject}</span>
        </span>

        {branches.map((branch) => (
          <span
            key={branch}
            className={cn(
              'px-1 py-0.5 text-[10px] font-medium rounded shrink-0 leading-none',
              branch === 'main' || branch === 'master'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-green-500/20 text-green-400'
            )}
          >
            {branch}
          </span>
        ))}

        {tags.map((tag) => (
          <span
            key={tag}
            className="px-1 py-0.5 text-[10px] font-medium rounded bg-yellow-500/20 text-yellow-400 shrink-0 leading-none"
          >
            {tag}
          </span>
        ))}

        <div className="text-[9px] text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {commit.author} • {commit.date}
        </div>
      </div>
    </div>
  );
}
