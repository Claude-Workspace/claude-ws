'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Check, Loader2, Trash2, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plugin as AgentFactoryPlugin } from '@/types/agent-factory';
import { PluginUploadDialog } from './plugin-upload-dialog';

interface ComponentSelectorProps {
  type: 'component' | 'agent_set';
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  projectId: string;
  installedIds?: string[];
  onRefresh?: () => void;
  onCloseDialog?: () => void;
}

interface InstalledStatus {
  [componentId: string]: boolean;
}

export function ComponentSelector({ type, selectedIds, onChange, projectId, installedIds = [], onRefresh, onCloseDialog }: ComponentSelectorProps) {
  const t = useTranslations('agentFactory');
  const [components, setComponents] = useState<AgentFactoryPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [installedStatus, setInstalledStatus] = useState<InstalledStatus>({});
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const checkInstalledStatus = () => {
    const status: InstalledStatus = {};
    installedIds.forEach(id => {
      status[id] = true;
    });
    setInstalledStatus(status);
  };

  const fetchComponents = async () => {
    try {
      setLoading(true);
      const filterType = type === 'component' ? undefined : 'agent_set';
      const url = new URL('/api/agent-factory/plugins', window.location.origin);
      if (filterType) {
        url.searchParams.set('type', filterType);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch plugins');

      const data = await response.json();
      setComponents(data.plugins || []);
    } catch (error) {
      console.error('Error fetching plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  // Only fetch components when type changes (not when installedIds changes)
  useEffect(() => {
    fetchComponents();
  }, [type]);

  // Update installed status separately when installedIds changes
  useEffect(() => {
    checkInstalledStatus();
  }, [installedIds]);

  const toggleComponent = (componentId: string) => {
    if (selectedIds.includes(componentId)) {
      onChange(selectedIds.filter(id => id !== componentId));
    } else {
      onChange([...selectedIds, componentId]);
    }
  };

  const handleUninstall = async (componentId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setUninstalling(componentId);
    try {
      const response = await fetch(`/api/agent-factory/projects/${projectId}/uninstall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
        body: JSON.stringify({ componentId }),
      });

      if (!response.ok) {
        throw new Error('Failed to uninstall component');
      }

      // Remove from selected and update installed status
      onChange(selectedIds.filter(id => id !== componentId));
      setInstalledStatus(prev => {
        const updated = { ...prev };
        delete updated[componentId];
        return updated;
      });

      // Trigger refresh to update parent state
      onRefresh?.();
    } catch (error) {
      console.error('Error uninstalling component:', error);
      alert(t('failedToUninstallComponent'));
    } finally {
      setUninstalling(null);
    }
  };

  const filteredComponents = components.filter((component) => {
    const query = searchQuery.toLowerCase();
    return (
      component.name.toLowerCase().includes(query) ||
      component.description?.toLowerCase().includes(query)
    );
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
      {/* Header with Upload button */}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <button
          onClick={() => setUploadDialogOpen(true)}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Upload className="h-3 w-3" />
          Upload Plugins
        </button>
      </div>

      {/* Search bar */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${title.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Component list */}
      <ScrollArea className="h-[200px]">
        <div className="p-2 space-y-1">
          {filteredComponents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? 'No plugins found' : `No ${title.toLowerCase()} available`}
            </div>
          ) : (
            filteredComponents.map((component) => {
              const isSelected = selectedIds.includes(component.id);
              const isInstalled = installedStatus[component.id];

              return (
                <div
                  key={component.id}
                  className={`relative flex items-start gap-3 p-3 rounded-md transition-colors ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                  } ${isInstalled ? 'border border-green-200 dark:border-green-900' : ''}`}
                >
                  <div
                    className="flex items-start gap-3 flex-1"
                    onClick={() => toggleComponent(component.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleComponent(component.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{component.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {component.type}
                        </span>
                        {isInstalled && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Installed
                          </span>
                        )}
                      </div>
                      {component.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {component.description}
                        </p>
                      )}
                      {component.storageType && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Source: {component.storageType}
                        </p>
                      )}
                    </div>
                    {isSelected && !isInstalled && (
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* Uninstall button - absolute positioned in bottom right */}
                  {isInstalled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute bottom-2 right-2 h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleUninstall(component.id, e)}
                      disabled={uninstalling === component.id}
                    >
                      {uninstalling === component.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Uninstall
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })
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

      {/* Upload Dialog */}
      <PluginUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        projectId={projectId}
        onUploadSuccess={() => {
          fetchComponents();
          onRefresh?.();
        }}
      />
    </div>
  );
}
