'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Copy, Check, FileIcon, FilePlus, FileMinus, ArrowLeft, GitBranch, GitCommit, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CommitDetails, CommitFile } from '@/types';
import { CommitFileDiffViewer } from './commit-file-diff-viewer';

const FILE_STATUS_CONFIG = {
  A: { icon: FilePlus, color: 'text-green-500' },
  M: { icon: FileIcon, color: 'text-yellow-500' },
  D: { icon: FileMinus, color: 'text-red-500' },
  R: { icon: FileIcon, color: 'text-blue-500' },
  C: { icon: FileIcon, color: 'text-purple-500' },
} as const;

interface CommitDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commitHash: string | null;
  projectPath: string;
}

export function CommitDetailsModal({
  open,
  onOpenChange,
  commitHash,
  projectPath,
}: CommitDetailsModalProps) {
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!commitHash) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/git/show?path=${encodeURIComponent(projectPath)}&hash=${commitHash}`,
        { signal: controller.signal }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch commit details');
      }
      const data = await res.json();
      setDetails(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [commitHash, projectPath]);

  useEffect(() => {
    if (!open || !commitHash) {
      setDetails(null);
      setError(null);
      setLoading(false);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(null);
    fetchDetails();
  }, [open, commitHash, projectPath, fetchDetails]);

  async function copyHash() {
    if (!details?.hash) return;

    try {
      await navigator.clipboard.writeText(details.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy hash:', err);
    }
  }

  async function handleCheckout() {
    if (!commitHash) return;

    setCheckoutLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/git/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          commitish: commitHash,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      setActionMessage({ type: 'success', text: data.message });

      // Trigger a git status refresh by dispatching a custom event
      window.dispatchEvent(new CustomEvent('git-status-refresh'));

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to checkout'
      });
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
        {selectedFile ? (
          // Show diff viewer
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setSelectedFile(null)}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <DialogTitle className="text-base">File Diff</DialogTitle>
            </div>
            <CommitFileDiffViewer
              filePath={selectedFile}
              commitHash={commitHash!}
              projectPath={projectPath}
              onClose={() => setSelectedFile(null)}
            />
          </div>
        ) : (
          // Show commit details
          <>
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="text-base">Commit Details</DialogTitle>
            </DialogHeader>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="px-6 py-4">
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                  <button
                    onClick={fetchDetails}
                    className="mt-2 text-xs text-destructive hover:underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {details && (
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {/* Action message */}
                {actionMessage && (
                  <div className={cn(
                    'mb-4 p-3 rounded-lg flex items-start gap-2',
                    actionMessage.type === 'success'
                      ? 'bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400'
                      : 'bg-destructive/10 border border-destructive/20 text-destructive'
                  )}>
                    {actionMessage.type === 'success' ? (
                      <Check className="size-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    )}
                    <span className="text-sm">{actionMessage.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {details.shortHash}
                    </code>
                    <button
                      onClick={copyHash}
                      className="p-1 hover:bg-accent rounded transition-colors"
                      title="Copy full hash"
                    >
                      {copied ? (
                        <Check className="size-3.5 text-green-500" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleCheckout}
                      disabled={checkoutLoading}
                      title="Checkout this commit (detached HEAD state)"
                    >
                      {checkoutLoading ? (
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      ) : (
                        <GitCommit className="size-3.5 mr-1.5" />
                      )}
                      Checkout
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowBranchDialog(true)}
                      title="Create a new branch from this commit"
                    >
                      <GitBranch className="size-3.5 mr-1.5" />
                      New Branch
                    </Button>
                  </div>
                </div>

                <div className="space-y-1 mb-4">
                  <div className="text-sm">
                    <span className="font-medium">{details.author}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      &lt;{details.authorEmail}&gt;
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {details.dateRelative} ({new Date(details.date).toLocaleString()})
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-semibold text-sm mb-2">{details.subject}</h3>
                  {details.body && (
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                      {details.body}
                    </pre>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium">
                      Files Changed ({details.stats.filesChanged})
                    </h4>
                    <div className="text-xs text-muted-foreground">
                      <span className="text-green-500">+{details.stats.additions}</span>
                      {' / '}
                      <span className="text-red-500">-{details.stats.deletions}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {details.files.map((file, idx) => (
                      <FileItem
                        key={idx}
                        file={file}
                        onClick={() => setSelectedFile(file.path)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Create Branch Dialog */}
    <CreateBranchDialog
      open={showBranchDialog}
      onOpenChange={setShowBranchDialog}
      projectPath={projectPath}
      startPoint={commitHash!}
      onSuccess={() => {
        // Show success message after branch is created
        setActionMessage({
          type: 'success',
          text: 'Branch created and checked out successfully'
        });
        setTimeout(() => setActionMessage(null), 3000);
      }}
    />
    </>
  );
}

function FileItem({
  file,
  onClick
}: {
  file: CommitFile;
  onClick: () => void;
}) {
  const config = FILE_STATUS_CONFIG[file.status];
  const Icon = config.icon;

  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/50 transition-colors cursor-pointer group"
      onClick={onClick}
      title={`Click to view diff for ${file.path}`}
    >
      <Icon className={cn('size-3.5 shrink-0', config.color)} />
      <span className="text-xs font-mono flex-1 truncate" title={file.path}>
        {file.path}
      </span>
      {file.status !== 'D' && (
        <div className="flex items-center gap-1.5 text-[10px] shrink-0">
          {file.additions > 0 && (
            <span className="text-green-500">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-red-500">-{file.deletions}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface CreateBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  startPoint: string;
  onSuccess?: () => void;
}

function CreateBranchDialog({
  open,
  onOpenChange,
  projectPath,
  startPoint,
  onSuccess,
}: CreateBranchDialogProps) {
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/git/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          branchName: branchName.trim(),
          startPoint,
          checkout: true, // Checkout the new branch after creation
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create branch');

      // Trigger a git status refresh
      window.dispatchEvent(new CustomEvent('git-status-refresh'));

      onSuccess?.();
      onOpenChange(false);
      setBranchName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Create New Branch</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="branch-name" className="text-sm font-medium">
              Branch Name
            </label>
            <input
              id="branch-name"
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/my-new-feature"
              className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              From commit: {startPoint.slice(0, 7)}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!branchName.trim() || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Creating...
                </>
              ) : (
                'Create & Checkout'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
