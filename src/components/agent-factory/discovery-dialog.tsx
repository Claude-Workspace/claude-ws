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
import { DiscoveredPlugin } from '@/types/agent-factory';
import { PluginDetailDialog } from './plugin-detail-dialog';
import { DiscoveredWithStatus } from '@/components/agent-factory/discovery-comparison-utils';
import { DiscoveryDialogScannedResultsPanel } from '@/components/agent-factory/discovery-dialog-scanned-results-panel';
import { useDiscoveryScanState } from '@/components/agent-factory/discovery-dialog-use-scan-state';
import { useDiscoveryImportActions } from '@/components/agent-factory/discovery-dialog-use-import-actions';

interface DiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscoveryDialog({ open, onOpenChange }: DiscoveryDialogProps) {
  const t = useTranslations('agentFactory');
  const tCommon = useTranslations('common');
  const [detailPlugin, setDetailPlugin] = useState<DiscoveredWithStatus | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const {
    discovered, selectedIds, processingIds, scanned, scanning,
    expandedFolders, statusMap,
    setSelectedIds, setProcessingIds, setStatusMap,
    handleScan, resetScanState, toggleFolder, toggleSelection,
    checkPluginStatus, buildStatusMap,
  } = useDiscoveryScanState();

  useEffect(() => {
    if (open && !scanned) resetScanState();
  }, [open]);

  const { newCount, updateCount, currentCount, needsAction } = useMemo(() => {
    let n = 0, u = 0, c = 0;
    for (const s of statusMap.values()) {
      if (s.status === 'new') n++;
      else if (s.status === 'update') u++;
      else if (s.status === 'current') c++;
    }
    return { newCount: n, updateCount: u, currentCount: c, needsAction: n + u };
  }, [statusMap]);

  const handleDetailClick = useCallback((plugin: DiscoveredPlugin, e: React.MouseEvent) => {
    e.stopPropagation();
    const status = statusMap.get(`${plugin.type}-${plugin.name}`);
    if (status) { setDetailPlugin(status); setDetailOpen(true); }
  }, [statusMap]);

  const { handleImportSelected, handleImportAll, handleImportSingle } = useDiscoveryImportActions({
    discovered, selectedIds, statusMap,
    setImporting, setProcessingIds, setStatusMap, setSelectedIds,
    checkPluginStatus, buildStatusMap,
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Package className="w-6 h-6" />
              {t('discoverPlugins')}
            </DialogTitle>
            <DialogDescription>{t('scanDescription')}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {!scanned ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="mb-4">{t('clickScanToSearch')}</p>
                <Button onClick={handleScan} disabled={scanning}>
                  {scanning
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{tCommon('scanning')}</>
                    : <><Search className="w-4 h-4 mr-2" />{t('scan')}</>}
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
                  <RefreshCw className="w-4 h-4 mr-2" />Rescan
                </Button>
              </div>
            ) : (
              <DiscoveryDialogScannedResultsPanel
                discovered={discovered} statusMap={statusMap}
                expandedFolders={expandedFolders} selectedIds={selectedIds} processingIds={processingIds}
                newCount={newCount} updateCount={updateCount} currentCount={currentCount}
                onToggleFolder={toggleFolder} onToggleSelection={toggleSelection}
                onImport={handleImportSingle} onPluginClick={handleDetailClick}
              />
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : scanned && `${needsAction} need action`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>{tCommon('close')}</Button>
              {scanned && discovered.length > 0 && (
                <>
                  <Button variant="outline" onClick={handleScan} disabled={scanning}>
                    <RefreshCw className="w-4 h-4 mr-2" />{t('rescan')}
                  </Button>
                  {needsAction > 0 && (
                    <Button onClick={handleImportAll} disabled={importing || scanning}>
                      {importing
                        ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{tCommon('importing')}</>
                        : <>{t('importAll')} ({needsAction})</>}
                    </Button>
                  )}
                  {selectedIds.size > 0 && (
                    <Button onClick={handleImportSelected} disabled={importing || scanning}>
                      {importing
                        ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{tCommon('importing')}</>
                        : t('importSelected', { count: selectedIds.size })}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {detailPlugin && (
        <PluginDetailDialog plugin={detailPlugin} open={detailOpen} onOpenChange={setDetailOpen} />
      )}
    </>
  );
}
