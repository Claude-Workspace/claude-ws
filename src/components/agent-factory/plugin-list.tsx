'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Package, Plus, RefreshCw, Search, Trash2, Edit, X, Upload } from 'lucide-react';
import { useAgentFactoryStore } from '@/stores/agent-factory-store';
import { useAgentFactoryUIStore } from '@/stores/agent-factory-ui-store';
import { Plugin } from '@/types/agent-factory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PluginDetailDialog } from './plugin-detail-dialog';
import { PluginFormDialog } from './plugin-form-dialog';
import { DiscoveryDialog } from './discovery-dialog';
import { UploadDialog } from './upload-dialog';

export function PluginList() {
  const t = useTranslations('agentFactory');
  const tCommon = useTranslations('common');
  const { plugins, loading, error, fetchPlugins, deletePlugin } = useAgentFactoryStore();
  const { setOpen: setAgentFactoryOpen } = useAgentFactoryUIStore();
  const [filter, setFilter] = useState<'all' | 'skill' | 'command' | 'agent' | 'agent_set'>('all');
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
    // Only show plugins in CLAUDE_HOME_DIR/agent-factory
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'skill':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'command':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'agent':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'agent_set':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'agent_set':
        return 'Agent Set';
      default:
        return type;
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

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-6">
        {t('description')}
      </p>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-2">
          {(['all', 'skill', 'command', 'agent', 'agent_set'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {type === 'all' ? t('all') : type === 'agent_set' ? t('agentSets') : type === 'skill' ? t('skills') : type === 'command' ? t('commands') : t('agents')}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlugins')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          {t('loadingPlugins')}
        </div>
      )}

      {/* Plugin Grid */}
      {!loading && (
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlugins.map((plugin) => (
            <div
              key={plugin.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedPlugin(plugin)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">{plugin.name}</h3>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(plugin.type)}`}>
                  {getTypeLabel(plugin.type)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {plugin.description || t('noDescription')}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{plugin.storageType}</span>
                <span>•</span>
                <span>{new Date(plugin.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditingPlugin(plugin)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(plugin.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredPlugins.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">{t('noPluginsFound')}</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || filter !== 'all'
              ? t('adjustFilters')
              : t('getStartedDiscover')}
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

      {/* Dialogs */}
      {selectedPlugin && (
        <PluginDetailDialog
          plugin={selectedPlugin}
          open={!!selectedPlugin}
          onOpenChange={(open) => !open && setSelectedPlugin(null)}
        />
      )}

      {createFormOpen && (
        <PluginFormDialog
          open={createFormOpen}
          onOpenChange={setCreateFormOpen}
        />
      )}

      {editingPlugin && (
        <PluginFormDialog
          plugin={editingPlugin}
          open={!!editingPlugin}
          onOpenChange={(open) => !open && setEditingPlugin(null)}
        />
      )}

      {discoveryOpen && (
        <DiscoveryDialog
          open={discoveryOpen}
          onOpenChange={setDiscoveryOpen}
        />
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
