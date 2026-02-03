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
  allRemoteBranches?: string[]; // All remote branches like ['origin/dev', 'origin/main']
}

// Parse refs to extract branch/tag names
function parseRefs(refs: string[], allRemoteBranches: string[] = []): {
  localBranches: string[];
  remoteBranches: string[];
  tags: string[];
} {
  const localBranches: string[] = [];
  const remoteBranches: string[] = [];
  const tags: string[] = [];

  // Create a Set of remote branch names for quick lookup
  const remoteBranchSet = new Set(
    allRemoteBranches.map(ref => {
      const parts = ref.split('/');
      return parts[parts.length - 1]; // Extract branch name from 'origin/dev'
    })
  );

  for (const ref of refs) {
    if (ref.startsWith('HEAD -> ')) {
      localBranches.push(ref.replace('HEAD -> ', ''));
    } else if (ref.startsWith('tag: ')) {
      tags.push(ref.replace('tag: ', ''));
    } else if (ref.includes('/')) {
      // Remote branch like origin/main or origin/dev
      const branchName = ref.split('/').pop() || ref;
      remoteBranches.push(branchName);
    } else {
      // Local branch
      localBranches.push(ref);
    }
  }

  // If we have local branches but no remote branches in refs,
  // check if corresponding remote branches exist in allRemoteBranches
  if (localBranches.length > 0 && remoteBranches.length === 0 && allRemoteBranches.length > 0) {
    for (const localBranch of localBranches) {
      if (remoteBranchSet.has(localBranch)) {
        remoteBranches.push(localBranch);
      }
    }
  }

  return {
    localBranches: [...new Set(localBranches)],
    remoteBranches: [...new Set(remoteBranches)],
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
  allRemoteBranches = [],
}: GitCommitItemProps) {
  const { prefix, scope, subject } = parseCommitMessage(commit.message);
  const { localBranches, remoteBranches, tags } = parseRefs(commit.refs, allRemoteBranches);

  return (
    <div
      className="flex-1 min-w-0 pl-0 pr-2 flex items-center gap-1.5 cursor-pointer group transition-colors"
      onClick={onClick}
      title={`${commit.message}\n${commit.author} • ${commit.date} • ${commit.shortHash}`}
    >
      {/* Commit message - single line only */}
      <div className="text-[12px] leading-tight truncate flex-1 min-w-0">
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
      </div>

      {/* Branch badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Local branches - green */}
        {localBranches.slice(0, 1).map((branch) => (
          <span
            key={`local-${branch}`}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium leading-none border border-green-500/30"
            style={{
              backgroundColor: `rgba(34, 197, 94, 0.2)`,
              color: '#4ade80',
            }}
            title={`Local branch: ${branch}${isHead ? ' (HEAD)' : ''}`}
          >
            @{branch}
          </span>
        ))}

        {/* Remote branches - sky blue with globe */}
        {remoteBranches.slice(0, 1).map((branch) => (
          <span
            key={`remote-${branch}`}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium leading-none border border-sky-500/30 flex items-center gap-0.5"
            style={{
              backgroundColor: `rgba(14, 165, 233, 0.2)`,
              color: '#38bdf8',
            }}
            title={`Remote branch: origin/${branch}`}
          >
            @{branch}
            <span className="text-[9px]">🌐</span>
          </span>
        ))}

        {/* Tags - color matches lane color */}
        {tags.slice(0, 1).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
