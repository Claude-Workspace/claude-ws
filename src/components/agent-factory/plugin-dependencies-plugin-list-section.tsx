'use client';

/**
 * Section component showing plugin-to-plugin dependency tree (or flat list) for a plugin.
 * Renders a DependencyTree if tree data is available, otherwise renders a flat badge list.
 */

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle } from 'lucide-react';
import { DependencyTree, type DependencyTreeNode, countPlugins } from './dependency-tree';

interface PluginDep {
  type: 'skill' | 'command' | 'agent';
  name: string;
}

function getTypeColor(type: string) {
  switch (type) {
    case 'skill':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'command':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'agent':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

interface PluginDependenciesPluginListSectionProps {
  plugins: PluginDep[];
  dependencyTree?: DependencyTreeNode[];
  depth?: number;
  hasCycles?: boolean;
  resolvedAt?: number;
}

export function PluginDependenciesPluginListSection({
  plugins,
  dependencyTree,
  depth,
  hasCycles,
  resolvedAt,
}: PluginDependenciesPluginListSectionProps) {
  const t = useTranslations('agentFactory');
  const count = dependencyTree ? countPlugins(dependencyTree) : plugins.length;
  const isEmpty = (!dependencyTree || dependencyTree.length === 0) && plugins.length === 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{t('pluginDependencies')}</h3>
        <Badge variant="secondary">{count}</Badge>
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground pl-6">{t('noPluginDependencies')}</p>
      ) : (
        <div className="pl-6">
          {dependencyTree ? (
            <DependencyTree nodes={dependencyTree} />
          ) : (
            <div className="space-y-2">
              {plugins.map((plug, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Badge className={getTypeColor(plug.type)}>{plug.type}</Badge>
                  <span className="text-sm">{plug.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(depth !== undefined || hasCycles) && (
        <div className="text-xs text-muted-foreground pl-6 space-y-1 pt-2 border-t">
          {depth !== undefined && (
            <div>
              Resolution depth:{' '}
              <span className="font-medium text-foreground">{depth}</span>
            </div>
          )}
          {hasCycles && (
            <div className="text-orange-500">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              {t('circularDependencies')}
            </div>
          )}
          {resolvedAt && (
            <div>Last resolved: {new Date(resolvedAt).toLocaleString()}</div>
          )}
        </div>
      )}
    </div>
  );
}
