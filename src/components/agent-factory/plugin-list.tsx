'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Package, Plus, RefreshCw, X, Upload } from 'lucide-react';
import { useAgentFactoryStore } from '@/stores/agent-factory-store';
import { useAgentFactoryUIStore } from '@/stores/agent-factory-ui-store';
import { Plugin } from '@/types/agent-factory';
import { Button } from '@/components/ui/button';
import { PluginDetailDialog } from './plugin-detail-dialog';
import { PluginFormDialog } from './plugin-form-dialog';
import { DiscoveryDialog } from './discovery-dialog';
import { UploadDialog } from './upload-dialog';
import { PluginListCard } from '@/components/agent-factory/plugin-list-card';
import { PluginListFilterBar } from '@/components/agent-factory/plugin-list-filter-bar';

type PluginTypeFilter = 'all' | 'skill' | 'command' | 'agent' | 'agent_set';

export function PluginList() {
  const t = useTranslations('agentFactory');
  const tCommon = useTranslations('common');
  const { plugins, loading, error, fetchPlugins, deletePlugin } = useAgentFactoryStore();
  const { setOpen: setAgentFactoryOpen } = useAgentFactoryUIStore();
  const [filter, setFilter] = useState<PluginTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const filteredPlugins = plugins.filter((p) => {
    if (!p) return false;
    const matchesStorage = p.storageType === 'imported' || p.storageType === 'local';
    const matchesFilter = filter === 'all' || p.type === filter;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const isInAgentFactory = p.type === 'agent_set'
      ? (p.agentSetPath?.includes('/agent-factory/') ?? false)
      : (p.sourcePath?.includes('/agent-factory/') ?? false);
    return matchesStorage && matchesFilter && matchesSearch && isInAgentFactory;
  });

  const handleDelete = async (id: string) => {
    if (!confirm(t('deletePluginConfirm'))) return;
    try {
      await deletePlugin(id);
    } catch (error) {
      console.error('Failed to delete plugin:', error);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center justify-between sm:justify-normal gap-3">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6" />
            <h1 className="text-2xl font-bold">{t('title')}</h1>
          </div>
          <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setAgentFactoryOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => fetchPlugins()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {tCommon('refresh')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDiscoveryOpen(true)}>
            <Package className="w-4 h-4 mr-2" />
            {tCommon('discover')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            {tCommon('upload')}
          </Button>
          <Button size="sm" onClick={() => setCreateFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {tCommon('new')}
          </Button>
          <Button variant="ghost" size="icon" className="hidden sm:flex" onClick={() => setAgentFactoryOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">{t('description')}</p>

      <div className="mb-6">
        <PluginListFilterBar
          filter={filter}
          searchQuery={searchQuery}
          onFilterChange={setFilter}
          onSearchChange={setSearchQuery}
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          {t('loadingPlugins')}
        </div>
      )}

      {!loading && (
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlugins.map((plugin) => (
              <PluginListCard
                key={plugin.id}
                plugin={plugin}
                onClick={setSelectedPlugin}
                onEdit={setEditingPlugin}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && filteredPlugins.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">{t('noPluginsFound')}</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || filter !== 'all' ? t('adjustFilters') : t('getStartedDiscover')}
          </p>
          {!searchQuery && filter === 'all' && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setDiscoveryOpen(true)}>
                <Package className="w-4 h-4 mr-2" />
                {tCommon('discover')}
              </Button>
              <Button variant="outline" onClick={() => setUploadOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                {tCommon('upload')}
              </Button>
              <Button onClick={() => setCreateFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {tCommon('new')}
              </Button>
            </div>
          )}
        </div>
      )}

      {selectedPlugin && (
        <PluginDetailDialog
          plugin={selectedPlugin}
          open={!!selectedPlugin}
          onOpenChange={(open) => !open && setSelectedPlugin(null)}
        />
      )}
      {createFormOpen && (
        <PluginFormDialog open={createFormOpen} onOpenChange={setCreateFormOpen} />
      )}
      {editingPlugin && (
        <PluginFormDialog
          plugin={editingPlugin}
          open={!!editingPlugin}
          onOpenChange={(open) => !open && setEditingPlugin(null)}
        />
      )}
      {discoveryOpen && (
        <DiscoveryDialog open={discoveryOpen} onOpenChange={setDiscoveryOpen} />
      )}
      {uploadOpen && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUploadSuccess={() => fetchPlugins()}
        />
      )}
    </div>
  );
}
