'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, GitBranch, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface Branch {
  name: string;
  isCurrent: boolean;
  upstream: string | null;
  type: 'local' | 'remote';
}

interface BranchCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  currentBranch: string;
  onCheckout: (branch: string) => Promise<void>;
}

export function BranchCheckoutModal({
  open,
  onOpenChange,
  projectPath,
  currentBranch,
  onCheckout,
}: BranchCheckoutModalProps) {
  const t = useTranslations('git');
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<{ local: Branch[]; remote: Branch[] }>({
    local: [],
    remote: [],
  });
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    if (!projectPath) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/git/branches?path=${encodeURIComponent(projectPath)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('failedToFetchBranches'));
      }
      const data = await res.json();
      setBranches({
        local: data.localBranches || [],
        remote: data.remoteBranches || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToFetchBranches'));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    if (open) {
      fetchBranches();
      setSearch('');
    }
  }, [open, fetchBranches]);

  const handleCheckout = async (branchName: string) => {
    setCheckingOut(branchName);
    setError(null);
    try {
      await onCheckout(branchName);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to checkout branch');
    } finally {
      setCheckingOut(null);
    }
  };

  const filteredLocalBranches = branches.local.filter((branch) =>
    branch.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRemoteBranches = branches.remote.filter((branch) =>
    branch.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[500px]">
        <DialogHeader className="px-4 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-5" />
            Checkout Branch
          </DialogTitle>
          <DialogDescription>
            Select a branch to checkout. Currently on <strong>{currentBranch}</strong>
          </DialogDescription>
        </DialogHeader>

        <Command className="rounded-t-none border-t">
          <CommandInput
            placeholder={t('searchBranches')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <p className="text-sm text-destructive mb-2">{error}</p>
                <button
                  className="text-sm text-primary hover:underline"
                  onClick={fetchBranches}
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                {filteredLocalBranches.length === 0 && filteredRemoteBranches.length === 0 ? (
                  <CommandEmpty>{t('noBranches')}</CommandEmpty>
                ) : (
                  <>
                    {filteredLocalBranches.length > 0 && (
                      <CommandGroup heading="Local Branches">
                        {filteredLocalBranches.map((branch) => (
                          <CommandItem
                            key={branch.name}
                            value={branch.name}
                            onSelect={() => handleCheckout(branch.name)}
                            className="cursor-pointer"
                          >
                            <GitBranch className="size-4 text-muted-foreground" />
                            <span className="flex-1">{branch.name}</span>
                            {branch.isCurrent && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Check className="size-3" />
                                current
                              </span>
                            )}
                            {checkingOut === branch.name && (
                              <Loader2 className="size-4 animate-spin" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {filteredRemoteBranches.length > 0 && (
                      <CommandGroup heading="Remote Branches">
                        {filteredRemoteBranches.map((branch) => (
                          <CommandItem
                            key={branch.name}
                            value={branch.name}
                            onSelect={() => handleCheckout(branch.name)}
                            className="cursor-pointer"
                          >
                            <GitBranch className="size-4 text-muted-foreground" />
                            <span className="flex-1">{branch.name}</span>
                            {checkingOut === branch.name && (
                              <Loader2 className="size-4 animate-spin" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
