'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Search, RefreshCw, RotateCcw, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { useAgentFactoryStore } from '@/stores/agent-factory-store';
import { DiscoveredPlugin, DiscoveredFolder, DiscoveredNode, Plugin } from '@/types/agent-factory';
import { PluginDetailDialog } from './plugin-detail-dialog';

interface DiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DiscoveredWithStatus extends DiscoveredPlugin {
  status: 'new' | 'update' | 'current';
  existingPlugin?: {
    id: string;
    sourcePath: string | null;
    updatedAt: number;
  };
}

interface CompareResponse {
  plugins: DiscoveredWithStatus[];
}

// Helper to flatten tree for comparison
function flattenTree(nodes: DiscoveredNode[]): DiscoveredPlugin[] {
  const result: DiscoveredPlugin[] = [];
  function traverse(nodes: DiscoveredNode[]) {
    for (const node of nodes) {
      if (node.type === 'folder') {
        traverse(node.children);
      } else {
        result.push(node);
      }
    }
  }
  traverse(nodes);
  return result;
}

// Get all items in a folder (recursively)
function getAllItemsInFolder(node: DiscoveredNode): DiscoveredPlugin[] {
  if (node.type !== 'folder') return [node];
  const items: DiscoveredPlugin[] = [];
  function traverse(n: DiscoveredNode) {
    if (n.type === 'folder') {
      for (const child of n.children) {
        traverse(child);
      }
    } else {
      items.push(n);
    }
  }
  traverse(node);
  return items;
}

// Generate unique key for a node
function getNodeKey(node: DiscoveredNode, index: number): string {
  if (node.type === 'folder') {
    return `folder-${node.path}-${index}`;
  }
  return `${node.type}-${node.name}-${node.sourcePath}`;
}

// Memoized tree node component
interface TreeNodeProps {
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

const TreeNode = memo(function TreeNode({
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

  const getTypeColor = (type: string) => {
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
  };

  const getStatusBadge = (status: string) => {
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
  };

  // For folders, check if all children are selected
  let isSelected = false;
  let isIndeterminate = false;
  let folderStatus: 'new' | 'update' | 'current' | 'mixed' = 'mixed';
  let hasActionableItems = false;

  if (node.type === 'folder') {
    const items = getAllItemsInFolder(node);
    const selectedItems = items.filter(item => {
      const itemKey = getNodeKey(item, 0);
      return selectedIds.has(itemKey);
    });
    isSelected = items.length > 0 && selectedItems.length === items.length;
    isIndeterminate = selectedItems.length > 0 && selectedItems.length < items.length;

    // Determine overall folder status
    const statuses = items.map(item => statusMap.get(`${item.type}-${item.name}`)?.status);
    const hasNew = statuses.includes('new');
    const hasUpdate = statuses.includes('update');
    const hasCurrent = statuses.includes('current');

    if (hasNew || hasUpdate) hasActionableItems = true;
    if (hasNew && !hasUpdate && !hasCurrent) folderStatus = 'new';
    else if (hasUpdate && !hasNew && !hasCurrent) folderStatus = 'update';
    else if (hasCurrent && !hasNew && !hasUpdate) folderStatus = 'current';
    else folderStatus = 'mixed';
  }

  if (node.type !== 'folder') {
    const status = statusMap.get(`${node.type}-${node.name}`);
    isSelected = selectedIds.has(key);
    if (status?.status !== 'current') hasActionableItems = true;
  }

  const isProcessing = processingIds.has(key);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
          node.type === 'folder'
            ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/50 bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800'
            : 'cursor-pointer hover:border-primary/70 ' + (
                statusMap.get(`${node.type}-${node.name}`)?.status === 'current'
                  ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 opacity-60'
                  : statusMap.get(`${node.type}-${node.name}`)?.status === 'update'
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
              disabled={statusMap.get(`${node.type}-${node.name}`)?.status === 'current' || isProcessing}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{node.name}</span>
                {getStatusBadge(statusMap.get(`${node.type}-${node.name}`)?.status || 'new')}
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
              disabled={statusMap.get(`${node.type}-${node.name}`)?.status === 'current' || isProcessing}
            >
              {isProcessing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : statusMap.get(`${node.type}-${node.name}`)?.status === 'current' ? (
                'Current'
              ) : statusMap.get(`${node.type}-${node.name}`)?.status === 'update' ? (
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

export function DiscoveryDialog({ open, onOpenChange }: DiscoveryDialogProps) {
  const t = useTranslations('agentFactory');
  const tCommon = useTranslations('common');
  const { plugins, discovering, discoverPlugins, importPlugin, fetchPlugins } = useAgentFactoryStore();
  const [discovered, setDiscovered] = useState<DiscoveredNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detailPlugin, setDetailPlugin] = useState<DiscoveredWithStatus | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [statusMap, setStatusMap] = useState<Map<string, DiscoveredWithStatus>>(new Map());

  useEffect(() => {
    if (open && !scanned) {
      setSelectedIds(new Set());
      setDiscovered([]);
      setScanned(false);
      setScanning(false);
      setExpandedFolders(new Set());
    }
  }, [open]);

  // Memoize filter counts to prevent recalculation on every render
  const { newCount, updateCount, currentCount, needsAction } = useMemo(() => {
    let newCount = 0, updateCount = 0, currentCount = 0;
    for (const status of statusMap.values()) {
      if (status.status === 'new') newCount++;
      else if (status.status === 'update') updateCount++;
      else if (status.status === 'current') currentCount++;
    }
    const needsAction = newCount + updateCount;
    return { newCount, updateCount, currentCount, needsAction };
  }, [statusMap]);

  // Memoize handlers to prevent recreation on every render
  const handleScan = useCallback(async () => {
    setScanning(true);
    setDiscovered([]);
    setStatusMap(new Map());
    setExpandedFolders(new Set());
    try {
      const results = await discoverPlugins();
      setDiscovered(results);

      // Build status map by flattening the tree
      const flatItems = flattenTree(results);
      const withStatus = await checkPluginStatus(flatItems);
      const newStatusMap = new Map<string, DiscoveredWithStatus>();
      for (const item of withStatus) {
        newStatusMap.set(`${item.type}-${item.name}`, item);
      }
      setStatusMap(newStatusMap);

      // Auto-expand top level folders
      const newExpanded = new Set<string>();
      results.forEach((node, index) => {
        if (node.type === 'folder') {
          newExpanded.add(getNodeKey(node, index));
        }
      });
      setExpandedFolders(newExpanded);

      setScanned(true);
    } catch (error) {
      console.error('Failed to scan plugins:', error);
    } finally {
      setScanning(false);
    }
  }, [discoverPlugins]);

  const checkPluginStatus = async (discoveredPlugins: DiscoveredPlugin[]): Promise<DiscoveredWithStatus[]> => {
    try {
      const res = await fetch('/api/agent-factory/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovered: discoveredPlugins }),
      });
      if (!res.ok) {
        throw new Error('Failed to compare plugins');
      }
      const data: CompareResponse = await res.json();
      return data.plugins;
    } catch (error) {
      console.error('Failed to compare plugins:', error);
      // Fallback: mark all as new
      return discoveredPlugins.map((p) => ({ ...p, status: 'new' as const }));
    }
  };

  const toggleFolder = useCallback((key: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  const toggleSelection = useCallback((node: DiscoveredNode, key: string) => {
    setSelectedIds((prev) => {
      const newSelected = new Set(prev);
      if (node.type === 'folder') {
        // For folders, select/deselect all descendants
        const items = getAllItemsInFolder(node);
        const isCurrentlySelected = items.every(item => {
          const itemKey = getNodeKey(item, 0);
          return newSelected.has(itemKey);
        });

        if (isCurrentlySelected) {
          // Deselect all
          for (const item of items) {
            newSelected.delete(getNodeKey(item, 0));
          }
        } else {
          // Select all
          for (const item of items) {
            newSelected.add(getNodeKey(item, 0));
          }
        }
      } else {
        // For individual items, just toggle
        if (newSelected.has(key)) {
          newSelected.delete(key);
        } else {
          newSelected.add(key);
        }
      }
      return newSelected;
    });
  }, []);

  const isSelected = useCallback((node: DiscoveredNode, key: string) => {
    return selectedIds.has(key);
  }, [selectedIds]);

  const isProcessing = useCallback((key: string) => {
    return processingIds.has(key);
  }, [processingIds]);

  const handleDetailClick = useCallback((plugin: DiscoveredPlugin, e: React.MouseEvent) => {
    e.stopPropagation();
    const status = statusMap.get(`${plugin.type}-${plugin.name}`);
    if (status) {
      setDetailPlugin(status);
      setDetailOpen(true);
    }
  }, [statusMap]);

  const handleImportSelected = useCallback(async () => {
    setImporting(true);
    try {
      // Get all selected items by key
      const itemsToImport: DiscoveredWithStatus[] = [];
      for (const [key, itemWithStatus] of statusMap) {
        if (selectedIds.has(key) && itemWithStatus.status !== 'current') {
          itemsToImport.push(itemWithStatus);
        }
      }

      for (const plugin of itemsToImport) {
        const key = `${plugin.type}-${plugin.name}`;
        setProcessingIds((prev) => new Set(prev).add(key));
        try {
          if (plugin.status === 'update' && plugin.existingPlugin) {
            await fetch(`/api/agent-factory/plugins/${plugin.existingPlugin.id}`, {
              method: 'DELETE',
            });
          }
          await importPlugin(plugin);
        } catch (error) {
          console.error(`Failed to import ${plugin.name}:`, error);
        }
        setProcessingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
      await fetchPlugins();
      // Refresh status after import
      const flatItems = flattenTree(discovered);
      const withStatus = await checkPluginStatus(flatItems);
      const newStatusMap = new Map<string, DiscoveredWithStatus>();
      for (const item of withStatus) {
        newStatusMap.set(`${item.type}-${item.name}`, item);
      }
      setStatusMap(newStatusMap);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to import plugins:', error);
    } finally {
      setImporting(false);
    }
  }, [discovered, selectedIds, statusMap, importPlugin, fetchPlugins]);

  const handleImportAll = useCallback(async () => {
    // Select all plugins that need action (new or update)
    const allToImport = new Set<string>();
    for (const [key, item] of statusMap) {
      if (item.status !== 'current') {
        allToImport.add(key);
      }
    }
    setSelectedIds(allToImport);
    // Wait a tick for state to update
    await new Promise(resolve => setTimeout(resolve, 0));
    await handleImportSelected();
  }, [statusMap, handleImportSelected]);

  const handleImportSingle = useCallback(async (plugin: DiscoveredPlugin) => {
    const key = `${plugin.type}-${plugin.name}`;
    setProcessingIds((prev) => new Set(prev).add(key));
    try {
      const status = statusMap.get(key);
      if (status?.status === 'update' && status.existingPlugin) {
        await fetch(`/api/agent-factory/plugins/${status.existingPlugin.id}`, {
          method: 'DELETE',
        });
      }
      await importPlugin(plugin);
      await fetchPlugins();
      // Update status
      setStatusMap((prev) => {
        const newMap = new Map(prev);
        const existing = plugins.find(
          (plug) => plug.type === plugin.type && plug.name === plugin.name && plug.storageType === 'imported'
        );
        const currentStatus = newMap.get(key);
        if (existing && currentStatus) {
          newMap.set(key, {
            ...currentStatus,
            status: 'current' as const,
            existingPlugin: {
              id: existing.id,
              sourcePath: existing.sourcePath ?? null,
              updatedAt: existing.updatedAt,
            }
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error(`Failed to import ${plugin.name}:`, error);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  }, [plugins, importPlugin, fetchPlugins, statusMap]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Package className="w-6 h-6" />
              {t('discoverPlugins')}
            </DialogTitle>
            <DialogDescription>
              {t('scanDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {!scanned ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="mb-4">{t('clickScanToSearch')}</p>
                <Button onClick={handleScan} disabled={scanning}>
                  {scanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      {tCommon('scanning')}
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      {t('scan')}
                    </>
                  )}
                </Button>
              </div>
            ) : scanning ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                {t('scanningForPlugins')}
              </div>
            ) : discovered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4">{t('noPluginsFoundScan')}</p>
                <Button variant="outline" onClick={handleScan} disabled={scanning}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rescan
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1 text-sm text-muted-foreground sticky top-0 bg-background">
                  <span>{statusMap.size} {t('pluginsFound')}</span>
                  <div className="flex gap-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {newCount} {t('newStatus')}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      {updateCount} {t('updates')}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      {currentCount} {t('current')}
                    </span>
                  </div>
                </div>
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
                    onToggleFolder={toggleFolder}
                    onToggleSelection={toggleSelection}
                    onImport={handleImportSingle}
                    onClick={handleDetailClick}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : scanned && `${needsAction} need action`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('close')}
              </Button>
              {scanned && discovered.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleScan}
                    disabled={scanning}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t('rescan')}
                  </Button>
                  {needsAction > 0 && (
                    <Button
                      onClick={handleImportAll}
                      disabled={importing || scanning}
                    >
                      {importing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          {tCommon('importing')}
                        </>
                      ) : (
                        <>
                          {t('importAll')} ({needsAction})
                        </>
                      )}
                    </Button>
                  )}
                  {selectedIds.size > 0 && (
                    <Button
                      onClick={handleImportSelected}
                      disabled={importing || scanning}
                    >
                      {importing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          {tCommon('importing')}
                        </>
                      ) : (
                        t('importSelected', { count: selectedIds.size })
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {detailPlugin && (
        <PluginDetailDialog
          plugin={detailPlugin}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </>
  );
}
