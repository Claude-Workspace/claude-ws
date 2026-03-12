/**
 * Custom hook encapsulating all import action handlers for the discovery dialog.
 * Isolates the bulk import, single import, and import-selected logic from the dialog JSX.
 */

import { useCallback } from 'react';
import { useAgentFactoryStore } from '@/stores/agent-factory-store';
import { DiscoveredPlugin, DiscoveredNode } from '@/types/agent-factory';
import { DiscoveredWithStatus, flattenTree } from '@/components/agent-factory/discovery-comparison-utils';

interface UseImportActionsParams {
  discovered: DiscoveredNode[];
  selectedIds: Set<string>;
  statusMap: Map<string, DiscoveredWithStatus>;
  setImporting: (v: boolean) => void;
  setProcessingIds: (fn: (prev: Set<string>) => Set<string>) => void;
  setStatusMap: (fn: (prev: Map<string, DiscoveredWithStatus>) => Map<string, DiscoveredWithStatus>) => void;
  setSelectedIds: (fn: (prev: Set<string>) => Set<string>) => void;
  checkPluginStatus: (plugins: DiscoveredPlugin[]) => Promise<DiscoveredWithStatus[]>;
  buildStatusMap: (items: DiscoveredWithStatus[]) => Map<string, DiscoveredWithStatus>;
}

export function useDiscoveryImportActions({
  discovered,
  selectedIds,
  statusMap,
  setImporting,
  setProcessingIds,
  setStatusMap,
  setSelectedIds,
  checkPluginStatus,
  buildStatusMap,
}: UseImportActionsParams) {
  const { plugins, importPlugin, fetchPlugins } = useAgentFactoryStore();

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
            await fetch(`/api/agent-factory/plugins/${plugin.existingPlugin.id}`, { method: 'DELETE' });
          }
          await importPlugin(plugin);
        } catch (error) {
          console.error(`Failed to import ${plugin.name}:`, error);
        }
        setProcessingIds((prev) => { const s = new Set(prev); s.delete(key); return s; });
      }
      await fetchPlugins();
      const flatItems = flattenTree(discovered);
      const withStatus = await checkPluginStatus(flatItems);
      setStatusMap(() => buildStatusMap(withStatus));
      setSelectedIds(() => new Set());
    } catch (error) {
      console.error('Failed to import plugins:', error);
    } finally {
      setImporting(false);
    }
  }, [discovered, selectedIds, statusMap, importPlugin, fetchPlugins, checkPluginStatus, buildStatusMap, setImporting, setProcessingIds, setStatusMap, setSelectedIds]);

  const handleImportAll = useCallback(async () => {
    const allToImport = new Set<string>();
    for (const [key, item] of statusMap) {
      if (item.status !== 'current') allToImport.add(key);
    }
    setSelectedIds(() => allToImport);
    await new Promise(resolve => setTimeout(resolve, 0));
    await handleImportSelected();
  }, [statusMap, handleImportSelected, setSelectedIds]);

  const handleImportSingle = useCallback(async (plugin: DiscoveredPlugin) => {
    const key = `${plugin.type}-${plugin.name}`;
    setProcessingIds((prev) => new Set(prev).add(key));
    try {
      const status = statusMap.get(key);
      if (status?.status === 'update' && status.existingPlugin) {
        await fetch(`/api/agent-factory/plugins/${status.existingPlugin.id}`, { method: 'DELETE' });
      }
      await importPlugin(plugin);
      await fetchPlugins();
      setStatusMap((prev) => {
        const newMap = new Map(prev);
        const existing = plugins.find(
          (p) => p.type === plugin.type && p.name === plugin.name && p.storageType === 'imported'
        );
        const currentStatus = newMap.get(key);
        if (existing && currentStatus) {
          newMap.set(key, {
            ...currentStatus,
            status: 'current' as const,
            existingPlugin: { id: existing.id, sourcePath: existing.sourcePath ?? null, updatedAt: existing.updatedAt },
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error(`Failed to import ${plugin.name}:`, error);
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, [plugins, importPlugin, fetchPlugins, statusMap, setProcessingIds, setStatusMap]);

  return { handleImportSelected, handleImportAll, handleImportSingle };
}
