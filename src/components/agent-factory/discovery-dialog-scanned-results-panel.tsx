'use client';

/**
 * Panel shown after scanning in the discovery dialog.
 * Renders the status summary bar (new/update/current counts) and the plugin tree.
 */

import { useTranslations } from 'next-intl';
import { DiscoveredPlugin, DiscoveredNode } from '@/types/agent-factory';
import { DiscoveredWithStatus, getNodeKey } from '@/components/agent-factory/discovery-comparison-utils';
import { TreeNode } from '@/components/agent-factory/discovery-tree-view';

interface DiscoveryDialogScannedResultsPanelProps {
  discovered: DiscoveredNode[];
  statusMap: Map<string, DiscoveredWithStatus>;
  expandedFolders: Set<string>;
  selectedIds: Set<string>;
  processingIds: Set<string>;
  newCount: number;
  updateCount: number;
  currentCount: number;
  onToggleFolder: (key: string) => void;
  onToggleSelection: (node: DiscoveredNode, key: string) => void;
  onImport: (plugin: DiscoveredPlugin) => void;
  onPluginClick: (plugin: DiscoveredPlugin, e: React.MouseEvent) => void;
}

export function DiscoveryDialogScannedResultsPanel({
  discovered,
  statusMap,
  expandedFolders,
  selectedIds,
  processingIds,
  newCount,
  updateCount,
  currentCount,
  onToggleFolder,
  onToggleSelection,
  onImport,
  onPluginClick,
}: DiscoveryDialogScannedResultsPanelProps) {
  const t = useTranslations('agentFactory');

  return (
    <div className="space-y-2">
      {/* Status summary bar */}
      <div className="flex items-center justify-between px-2 py-1 text-sm text-muted-foreground sticky top-0 bg-background">
        <span>{statusMap.size} {t('pluginsFound')}</span>
        <div className="flex gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {newCount} {t('newStatus')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            {updateCount} {t('updates')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            {currentCount} {t('current')}
          </span>
        </div>
      </div>

      {/* Plugin tree */}
      {discovered.map((node, index) => (
        <TreeNode
          key={getNodeKey(node, index)}
          node={node}
          index={index}
          level={0}
          statusMap={statusMap}
          expandedFolders={expandedFolders}
          selectedIds={selectedIds}
          processingIds={processingIds}
          onToggleFolder={onToggleFolder}
          onToggleSelection={onToggleSelection}
          onImport={onImport}
          onClick={onPluginClick}
        />
      ))}
    </div>
  );
}
