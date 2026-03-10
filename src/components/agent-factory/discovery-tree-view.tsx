'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, RotateCcw, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { DiscoveredPlugin, DiscoveredNode } from '@/types/agent-factory';
import { DiscoveredWithStatus, getAllItemsInFolder, getNodeKey } from '@/components/agent-factory/discovery-comparison-utils';

export interface TreeNodeProps {
  node: DiscoveredNode;
  index: number;
  level: number;
  statusMap: Map<string, DiscoveredWithStatus>;
  expandedFolders: Set<string>;
  selectedIds: Set<string>;
  processingIds: Set<string>;
  onToggleFolder: (key: string) => void;
  onToggleSelection: (node: DiscoveredNode, key: string) => void;
  onImport: (plugin: DiscoveredPlugin) => void;
  onClick: (plugin: DiscoveredPlugin, e: React.MouseEvent) => void;
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

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('agentFactory');
  switch (status) {
    case 'new':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{t('newStatus')}</span>;
    case 'update':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">{t('update')}</span>;
    case 'current':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">{t('current')}</span>;
    default:
      return null;
  }
}

function computeFolderState(node: DiscoveredNode, statusMap: Map<string, DiscoveredWithStatus>, selectedIds: Set<string>) {
  const items = getAllItemsInFolder(node);
  const selectedItems = items.filter(item => selectedIds.has(getNodeKey(item, 0)));
  const isSelected = items.length > 0 && selectedItems.length === items.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < items.length;

  const statuses = items.map(item => statusMap.get(`${item.type}-${item.name}`)?.status);
  const hasNew = statuses.includes('new');
  const hasUpdate = statuses.includes('update');
  const hasCurrent = statuses.includes('current');
  const hasActionableItems = hasNew || hasUpdate;

  let folderStatus: 'new' | 'update' | 'current' | 'mixed' = 'mixed';
  if (hasNew && !hasUpdate && !hasCurrent) folderStatus = 'new';
  else if (hasUpdate && !hasNew && !hasCurrent) folderStatus = 'update';
  else if (hasCurrent && !hasNew && !hasUpdate) folderStatus = 'current';

  return { isSelected, isIndeterminate, folderStatus, hasActionableItems, itemCount: items.length };
}

export const TreeNode = memo(function TreeNode({
  node,
  index,
  level,
  statusMap,
  expandedFolders,
  selectedIds,
  processingIds,
  onToggleFolder,
  onToggleSelection,
  onImport,
  onClick
}: TreeNodeProps) {
  const t = useTranslations('agentFactory');
  const key = getNodeKey(node, index);
  const isExpanded = expandedFolders.has(key);
  const nodeStatus = node.type !== 'folder' ? statusMap.get(`${node.type}-${node.name}`) : undefined;
  const isProcessing = processingIds.has(key);

  let isSelected = false;
  let hasActionableItems = false;
  let folderStatus: 'new' | 'update' | 'current' | 'mixed' = 'mixed';

  if (node.type === 'folder') {
    const folderState = computeFolderState(node, statusMap, selectedIds);
    isSelected = folderState.isSelected;
    hasActionableItems = folderState.hasActionableItems;
    folderStatus = folderState.folderStatus;
  } else {
    isSelected = selectedIds.has(key);
    if (nodeStatus?.status !== 'current') hasActionableItems = true;
  }

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
          node.type === 'folder'
            ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/50 bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800'
            : 'cursor-pointer hover:border-primary/70 ' + (
                nodeStatus?.status === 'current'
                  ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 opacity-60'
                  : nodeStatus?.status === 'update'
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              )
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={() => {
          if (node.type === 'folder') {
            onToggleFolder(key);
          } else {
            onClick(node, { stopPropagation: () => {} } as React.MouseEvent);
          }
        }}
      >
        {node.type === 'folder' ? (
          <>
            <button
              onClick={() => onToggleFolder(key)}
              className="p-0 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            <Folder className="w-4 h-4 text-muted-foreground" />
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(node, key)}
              disabled={!hasActionableItems}
            />
            <span className="font-medium flex-1">{node.name}</span>
            {folderStatus !== 'mixed' && folderStatus !== 'current' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {node.children.length} items
              </span>
            )}
          </>
        ) : (
          <>
            <div className="w-4" />
            <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(node.type)}`}>
              {node.type}
            </span>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(node, key)}
              disabled={nodeStatus?.status === 'current' || isProcessing}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{node.name}</span>
                <StatusBadge status={nodeStatus?.status || 'new'} />
              </div>
              {node.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {node.description}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onImport(node);
              }}
              disabled={nodeStatus?.status === 'current' || isProcessing}
            >
              {isProcessing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : nodeStatus?.status === 'current' ? (
                'Current'
              ) : nodeStatus?.status === 'update' ? (
                <>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  {t('update')}
                </>
              ) : (
                t('import')
              )}
            </Button>
          </>
        )}
      </div>
      {node.type === 'folder' && isExpanded && (
        <div>
          {node.children.map((child, childIndex) => (
            <TreeNode
              key={getNodeKey(child, childIndex)}
              node={child}
              index={childIndex}
              level={level + 1}
              statusMap={statusMap}
              expandedFolders={expandedFolders}
              selectedIds={selectedIds}
              processingIds={processingIds}
              onToggleFolder={onToggleFolder}
              onToggleSelection={onToggleSelection}
              onImport={onImport}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
});
