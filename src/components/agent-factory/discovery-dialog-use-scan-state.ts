/**
 * Custom hook managing scan state and folder/selection toggle logic for the discovery dialog.
 * Isolates scanning, status map building, folder expansion, and selection toggling.
 */

import { useState, useCallback } from 'react';
import { useAgentFactoryStore } from '@/stores/agent-factory-store';
import { DiscoveredPlugin, DiscoveredNode } from '@/types/agent-factory';
import {
  DiscoveredWithStatus,
  flattenTree,
  getAllItemsInFolder,
  getNodeKey,
} from '@/components/agent-factory/discovery-comparison-utils';

export function useDiscoveryScanState() {
  const { discoverPlugins } = useAgentFactoryStore();
  const [discovered, setDiscovered] = useState<DiscoveredNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [statusMap, setStatusMap] = useState<Map<string, DiscoveredWithStatus>>(new Map());

  const checkPluginStatus = useCallback(async (plugins: DiscoveredPlugin[]): Promise<DiscoveredWithStatus[]> => {
    try {
      const res = await fetch('/api/agent-factory/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovered: plugins }),
      });
      if (!res.ok) throw new Error('Failed to compare plugins');
      const data: { plugins: DiscoveredWithStatus[] } = await res.json();
      return data.plugins;
    } catch {
      return plugins.map((p) => ({ ...p, status: 'new' as const }));
    }
  }, []);

  const buildStatusMap = useCallback((items: DiscoveredWithStatus[]): Map<string, DiscoveredWithStatus> => {
    const map = new Map<string, DiscoveredWithStatus>();
    for (const item of items) map.set(`${item.type}-${item.name}`, item);
    return map;
  }, []);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setDiscovered([]);
    setStatusMap(new Map());
    setExpandedFolders(new Set());
    try {
      const results = await discoverPlugins();
      setDiscovered(results);
      const withStatus = await checkPluginStatus(flattenTree(results));
      setStatusMap(buildStatusMap(withStatus));
      const expanded = new Set<string>();
      results.forEach((node, i) => { if (node.type === 'folder') expanded.add(getNodeKey(node, i)); });
      setExpandedFolders(expanded);
      setScanned(true);
    } catch (error) {
      console.error('Failed to scan plugins:', error);
    } finally {
      setScanning(false);
    }
  }, [discoverPlugins, checkPluginStatus, buildStatusMap]);

  const resetScanState = useCallback(() => {
    setSelectedIds(new Set());
    setDiscovered([]);
    setScanned(false);
    setScanning(false);
    setExpandedFolders(new Set());
  }, []);

  const toggleFolder = useCallback((key: string) => {
    setExpandedFolders((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }, []);

  const toggleSelection = useCallback((node: DiscoveredNode, key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (node.type === 'folder') {
        const items = getAllItemsInFolder(node);
        const allSelected = items.every(item => next.has(getNodeKey(item, 0)));
        for (const item of items) allSelected ? next.delete(getNodeKey(item, 0)) : next.add(getNodeKey(item, 0));
      } else {
        next.has(key) ? next.delete(key) : next.add(key);
      }
      return next;
    });
  }, []);

  return {
    discovered, selectedIds, processingIds, scanned, scanning,
    expandedFolders, statusMap,
    setSelectedIds, setProcessingIds, setStatusMap,
    handleScan, resetScanState, toggleFolder, toggleSelection,
    checkPluginStatus, buildStatusMap,
  };
}
