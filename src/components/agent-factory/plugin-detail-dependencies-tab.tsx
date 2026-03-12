'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { type DependencyTreeNode } from './dependency-tree';
import { type InstallScripts } from './plugin-detail-install-scripts-panel';
import { PluginDependenciesLibrarySection } from '@/components/agent-factory/plugin-dependencies-library-section';
import { PluginDependenciesPluginListSection } from '@/components/agent-factory/plugin-dependencies-plugin-list-section';

interface LibraryDep {
  name: string;
  version?: string;
  manager: string;
}

export interface DependencyInfo {
  libraries: LibraryDep[];
  plugins: Array<{ type: 'skill' | 'command' | 'agent'; name: string }>;
  installScripts?: InstallScripts;
  dependencyTree?: DependencyTreeNode[];
  depth?: number;
  hasCycles?: boolean;
  resolvedAt?: number;
}

interface PluginIdentifier {
  id?: string;
  sourcePath?: string | null;
  type: string;
  isImported: boolean;
}

interface PluginDetailDependenciesTabProps {
  plugin: PluginIdentifier;
  error: string | null;
  setError: (error: string | null) => void;
}

export function PluginDetailDependenciesTab({ plugin, error, setError }: PluginDetailDependenciesTabProps) {
  const t = useTranslations('agentFactory');
  const [dependencies, setDependencies] = useState<DependencyInfo | null>(null);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [reResolvingDeps, setReResolvingDeps] = useState(false);

  useEffect(() => {
    fetchDependencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDependencies = async () => {
    setLoadingDeps(true);
    setError(null);
    try {
      let data;
      if (plugin.isImported) {
        const res = await fetch(`/api/agent-factory/plugins/${plugin.id}/dependencies`);
        if (!res.ok) throw new Error(t('failedToLoadDependencies'));
        data = await res.json();
      } else {
        const res = await fetch('/api/agent-factory/dependencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePath: plugin.sourcePath, type: plugin.type }),
        });
        if (!res.ok) throw new Error(t('failedToLoadDependencies'));
        data = await res.json();
      }
      setDependencies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadDependencies'));
    } finally {
      setLoadingDeps(false);
    }
  };

  const reResolveDependencies = async () => {
    setReResolvingDeps(true);
    setError(null);
    try {
      let data;
      if (plugin.isImported) {
        const res = await fetch(`/api/agent-factory/plugins/${plugin.id}/dependencies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ useClaude: true }),
        });
        if (!res.ok) throw new Error(t('failedToReResolveDependencies'));
        data = await res.json();
      } else {
        const res = await fetch('/api/agent-factory/dependencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePath: plugin.sourcePath, type: plugin.type, useClaude: true }),
        });
        if (!res.ok) throw new Error(t('failedToAnalyzeDependencies'));
        data = await res.json();
      }
      setDependencies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToReResolveDependencies'));
    } finally {
      setReResolvingDeps(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {dependencies?.resolvedAt
            ? `Last resolved: ${new Date(dependencies.resolvedAt).toLocaleString()}`
            : t('dependencies')}
        </div>
        <Button size="sm" variant="outline" onClick={reResolveDependencies} disabled={reResolvingDeps} className="gap-2">
          {reResolvingDeps ? (
            <><Loader2 className="w-3 h-3 animate-spin" />{t('reResolving')}</>
          ) : (
            <><RefreshCw className="w-3 h-3" />{t('reResolve')}</>
          )}
        </Button>
      </div>

      {loadingDeps ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-4">{error}</div>
      ) : !dependencies ? (
        <div className="text-sm text-muted-foreground py-4">{t('noDependenciesFound')}</div>
      ) : (
        <>
          <PluginDependenciesLibrarySection
            libraries={dependencies.libraries}
            installScripts={dependencies.installScripts}
          />
          <PluginDependenciesPluginListSection
            plugins={dependencies.plugins}
            dependencyTree={dependencies.dependencyTree}
            depth={dependencies.depth}
            hasCycles={dependencies.hasCycles}
            resolvedAt={dependencies.resolvedAt}
          />
        </>
      )}
    </div>
  );
}
