'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Search, RefreshCw, RotateCcw } from 'lucide-react';
import { useAgentFactoryStore } from '@/stores/agent-factory-store';
import { DiscoveredPlugin, Plugin } from '@/types/agent-factory';
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

// Memoized plugin item to prevent unnecessary re-renders
interface DiscoveredItemProps {
  plugin: DiscoveredWithStatus;
  isSelected: boolean;
  isProcessing: boolean;
  onToggle: (plugin: DiscoveredWithStatus) => void;
  onImport: (plugin: DiscoveredWithStatus) => void;
  onClick: (plugin: DiscoveredWithStatus, e: React.MouseEvent) => void;
}

const DiscoveredItem = memo(function DiscoveredItem({
  plugin,
  isSelected,
  isProcessing,
  onToggle,
  onImport,
  onClick
}: DiscoveredItemProps) {
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
        return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">New</span>;
      case 'update':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Update</span>;
      case 'current':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Current</span>;
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:border-primary/50 ${
        plugin.status === 'current'
          ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 opacity-60'
          : plugin.status === 'update'
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      }`}
      onClick={(e) => onClick(plugin, e)}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(plugin)}
        disabled={plugin.status === 'current' || isProcessing}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(plugin.type)}`}>
            {plugin.type}
          </span>
          <span className="font-medium">{plugin.name}</span>
          {getStatusBadge(plugin.status)}
        </div>
        {plugin.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {plugin.description}
          </p>
        )}
        <code className="text-xs text-muted-foreground block mt-1">
          {plugin.sourcePath}
        </code>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onImport(plugin);
        }}
        disabled={plugin.status === 'current' || isProcessing}
      >
        {isProcessing ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : plugin.status === 'current' ? (
          'Current'
        ) : plugin.status === 'update' ? (
          <>
            <RotateCcw className="w-3 h-3 mr-1" />
            Update
          </>
        ) : (
          'Import'
        )}
      </Button>
    </div>
  );
});

export function DiscoveryDialog({ open, onOpenChange }: DiscoveryDialogProps) {
  const { plugins, discovering, discoverPlugins, importPlugin, fetchPlugins } = useAgentFactoryStore();
  const [discovered, setDiscovered] = useState<DiscoveredWithStatus[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detailPlugin, setDetailPlugin] = useState<DiscoveredWithStatus | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (open && !scanned) {
      setSelectedIds(new Set());
      setDiscovered([]);
      setScanned(false);
      setScanning(false);
    }
  }, [open]);

  // Memoize filter counts to prevent recalculation on every render
  const { newCount, updateCount, currentCount, needsAction } = useMemo(() => ({
    newCount: discovered.filter((p) => p.status === 'new').length,
    updateCount: discovered.filter((p) => p.status === 'update').length,
    currentCount: discovered.filter((p) => p.status === 'current').length,
    needsAction: discovered.filter((p) => p.status !== 'current').length,
  }), [discovered]);

  // Memoize handlers to prevent recreation on every render
  const handleScan = useCallback(async () => {
    setScanning(true);
    setDiscovered([]);
    setScanned(false);
    try {
      const results = await discoverPlugins();
      const withStatus = await checkPluginStatus(results);
      setDiscovered(withStatus);
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

  const toggleSelection = useCallback((plugin: DiscoveredWithStatus) => {
    const key = `${plugin.type}-${plugin.name}`;
    setSelectedIds((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }
      return newSelected;
    });
  }, []);

  const isSelected = useCallback((plugin: DiscoveredWithStatus) => {
    return selectedIds.has(`${plugin.type}-${plugin.name}`);
  }, [selectedIds]);

  const isProcessing = useCallback((plugin: DiscoveredWithStatus) => {
    return processingIds.has(`${plugin.type}-${plugin.name}`);
  }, [processingIds]);

  const handleDetailClick = useCallback((plugin: DiscoveredWithStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailPlugin(plugin);
    setDetailOpen(true);
  }, []);

  const handleImportSelected = useCallback(async () => {
    setImporting(true);
    try {
      for (const plugin of discovered) {
        if (isSelected(plugin)) {
          const key = `${plugin.type}-${plugin.name}`;
          setProcessingIds((prev) => new Set(prev).add(key));
          try {
            if (plugin.status === 'update' && plugin.existingPlugin) {
              // Delete old and import new
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
      }
      await fetchPlugins();
      // Refresh status after import
      const results = await discoverPlugins();
      const withStatus = await checkPluginStatus(results);
      setDiscovered(withStatus);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to import plugins:', error);
    } finally {
      setImporting(false);
    }
  }, [discovered, isSelected, discoverPlugins, checkPluginStatus, importPlugin, fetchPlugins]);

  const handleImportAll = useCallback(async () => {
    // Select all plugins that need action (new or update)
    const allToImport = new Set(
      discovered
        .filter((p) => p.status !== 'current')
        .map((p) => `${p.type}-${p.name}`)
    );
    setSelectedIds(allToImport);
    await handleImportSelected();
  }, [discovered, handleImportSelected]);

  const handleImportSingle = useCallback(async (plugin: DiscoveredWithStatus) => {
    const key = `${plugin.type}-${plugin.name}`;
    setProcessingIds((prev) => new Set(prev).add(key));
    try {
      if (plugin.status === 'update' && plugin.existingPlugin) {
        // Delete old and import new
        await fetch(`/api/agent-factory/plugins/${plugin.existingPlugin.id}`, {
          method: 'DELETE',
        });
      }
      await importPlugin(plugin);
      await fetchPlugins();
      // Update status
      setDiscovered((prev) => prev.map((p) => {
        if (p.type === plugin.type && p.name === plugin.name) {
          const existing = plugins.find(
            (plug) => plug.type === plugin.type && plug.name === plugin.name && plug.storageType === 'imported'
          );
          return {
            ...p, status: 'current' as const, existingPlugin: existing ? {
              id: existing.id,
              sourcePath: existing.sourcePath ?? null,
              updatedAt: existing.updatedAt,
            } : undefined
          };
        }
        return p;
      }));
    } catch (error) {
      console.error(`Failed to import ${plugin.name}:`, error);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  }, [plugins, importPlugin, fetchPlugins]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Package className="w-6 h-6" />
              Discover Plugins
            </DialogTitle>
            <DialogDescription>
              Scan your filesystem for existing Claude plugins and import them into Agent Factory.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {!scanned ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="mb-4">Click the Scan button to search for plugins</p>
                <Button onClick={handleScan} disabled={scanning}>
                  {scanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Scan
                    </>
                  )}
                </Button>
              </div>
            ) : scanning ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                Scanning for plugins...
              </div>
            ) : discovered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4">No plugins found /skills, /commands, or /agents</p>
                <Button variant="outline" onClick={handleScan} disabled={scanning}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rescan
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1 text-sm text-muted-foreground">
                  <span>{discovered.length} plugins found</span>
                  <div className="flex gap-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {newCount} new
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      {updateCount} updates
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      {currentCount} current
                    </span>
                  </div>
                </div>
                {discovered.map((plugin) => (
                  <DiscoveredItem
                    key={`${plugin.type}-${plugin.name}`}
                    plugin={plugin}
                    isSelected={isSelected(plugin)}
                    isProcessing={isProcessing(plugin)}
                    onToggle={toggleSelection}
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
                Close
              </Button>
              {scanned && discovered.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleScan}
                    disabled={scanning}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Rescan
                  </Button>
                  {needsAction > 0 && (
                    <Button
                      onClick={handleImportAll}
                      disabled={importing || scanning}
                    >
                      {importing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          Import All ({needsAction})
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
                          Importing...
                        </>
                      ) : (
                        `Import ${selectedIds.size} Selected`
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
