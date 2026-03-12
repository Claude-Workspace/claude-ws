'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Loader2, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plugin as AgentFactoryPlugin } from '@/types/agent-factory';
import { PluginUploadDialog } from '@/components/project-settings/plugin-upload-dialog';
import { ComponentSelectorPluginListItem } from '@/components/project-settings/component-selector-plugin-list-item';

interface ComponentSelectorProps {
  type: 'component' | 'agent_set';
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  projectId: string;
  installedIds?: string[];
  onRefresh?: () => void;
  onCloseDialog?: () => void;
}

export function ComponentSelector({ type, selectedIds, onChange, projectId, installedIds = [], onRefresh, onCloseDialog }: ComponentSelectorProps) {
  const t = useTranslations('agentFactory');
  const [components, setComponents] = useState<AgentFactoryPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [installedStatus, setInstalledStatus] = useState<Record<string, boolean>>({});
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const fetchComponents = async () => {
    try {
      setLoading(true);
      const url = new URL('/api/agent-factory/plugins', window.location.origin);
      if (type === 'agent_set') url.searchParams.set('type', 'agent_set');
      const response = await fetch(url.toString(), {
        headers: { 'x-api-key': localStorage.getItem('apiKey') || '' },
      });
      if (!response.ok) throw new Error('Failed to fetch plugins');
      const data = await response.json();
      setComponents(data.plugins || []);
    } catch (error) {
      console.error('Error fetching plugins:', error);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchComponents(); }, [type]);

  useEffect(() => {
    const status: Record<string, boolean> = {};
    installedIds.forEach(id => { status[id] = true; });
    setInstalledStatus(status);
  }, [installedIds]);

  const toggleComponent = (componentId: string) => {
    onChange(selectedIds.includes(componentId)
      ? selectedIds.filter(id => id !== componentId)
      : [...selectedIds, componentId]);
  };

  const handleUninstall = async (componentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUninstalling(componentId);
    try {
      const response = await fetch(`/api/agent-factory/projects/${projectId}/uninstall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('apiKey') || '' },
        body: JSON.stringify({ componentId }),
      });
      if (!response.ok) throw new Error('Failed to uninstall component');
      onChange(selectedIds.filter(id => id !== componentId));
      setInstalledStatus(prev => { const u = { ...prev }; delete u[componentId]; return u; });
      onRefresh?.();
    } catch (error) {
      console.error('Error uninstalling component:', error);
      alert(t('failedToUninstallComponent'));
    } finally { setUninstalling(null); }
  };

  const filteredComponents = components.filter((c) => {
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
  });

  const title = type === 'component' ? 'Skills, Commands, Agents' : 'Agent Sets';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <button onClick={() => setUploadDialogOpen(true)}
          className="text-xs text-primary hover:underline flex items-center gap-1">
          <Upload className="h-3 w-3" />Upload Plugins
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={`Search ${title.toLowerCase()}...`} value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="h-[200px]">
        <div className="p-2 space-y-1">
          {filteredComponents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? 'No plugins found' : `No ${title.toLowerCase()} available`}
            </div>
          ) : (
            filteredComponents.map((component) => (
              <ComponentSelectorPluginListItem
                key={component.id}
                component={component}
                isSelected={selectedIds.includes(component.id)}
                isInstalled={!!installedStatus[component.id]}
                isUninstalling={uninstalling === component.id}
                onToggle={toggleComponent}
                onUninstall={handleUninstall}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Selection count */}
      {selectedIds.length > 0 && (
        <div className="p-2 border-t text-xs text-muted-foreground flex justify-between items-center">
          <span>{selectedIds.length} selected</span>
          {selectedIds.some(id => installedStatus[id]) && (
            <span className="text-green-600 dark:text-green-400">
              ({selectedIds.filter(id => installedStatus[id]).length} installed)
            </span>
          )}
        </div>
      )}

      <PluginUploadDialog
        open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}
        projectId={projectId}
        onUploadSuccess={() => { fetchComponents(); onRefresh?.(); }}
      />
    </div>
  );
}
