'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, Search, RefreshCw } from 'lucide-react';
import { useAgentFactoryStore } from '@/stores/agent-factory-store';
import { DiscoveredPlugin, DiscoveredNode } from '@/types/agent-factory';
import { PluginDetailDialog } from './plugin-detail-dialog';
import { DiscoveredWithStatus, flattenTree, getAllItemsInFolder, getNodeKey } from '@/components/agent-factory/discovery-comparison-utils';
import { TreeNode } from '@/components/agent-factory/discovery-tree-view';

interface DiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
      const data: { plugins: DiscoveredWithStatus[] } = await res.json();
      return data.plugins;
    } catch (error) {
      console.error('Failed to compare plugins:', error);
      return discoveredPlugins.map((p) => ({ ...p, status: 'new' as const }));
    }
  };

  const buildStatusMap = (items: DiscoveredWithStatus[]): Map<string, DiscoveredWithStatus> => {
    const map = new Map<string, DiscoveredWithStatus>();
    for (const item of items) {
      map.set(`${item.type}-${item.name}`, item);
    }
    return map;
  };

  const handleScan = useCallback(async () => {
    setScanning(true);
    setDiscovered([]);
    setStatusMap(new Map());
    setExpandedFolders(new Set());
    try {
      const results = await discoverPlugins();
      setDiscovered(results);

      const flatItems = flattenTree(results);
      const withStatus = await checkPluginStatus(flatItems);
      setStatusMap(buildStatusMap(withStatus));

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
        const items = getAllItemsInFolder(node);
        const isCurrentlySelected = items.every(item => newSelected.has(getNodeKey(item, 0)));

        if (isCurrentlySelected) {
          for (const item of items) {
            newSelected.delete(getNodeKey(item, 0));
          }
        } else {
          for (const item of items) {
            newSelected.add(getNodeKey(item, 0));
          }
        }
      } else {
        if (newSelected.has(key)) {
          newSelected.delete(key);
        } else {
          newSelected.add(key);
        }
      }
      return newSelected;
    });
  }, []);

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
      setStatusMap(buildStatusMap(withStatus));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to import plugins:', error);
    } finally {
      setImporting(false);
    }
  }, [discovered, selectedIds, statusMap, importPlugin, fetchPlugins]);

  const handleImportAll = useCallback(async () => {
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
