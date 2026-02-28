'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Save, X, Loader2, CheckCircle, AlertCircle, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectStore } from '@/stores/project-store';
import { ComponentSelector } from './component-selector';
import { useProjectSettingsStore } from '@/stores/project-settings-store';
import { useAgentFactoryUIStore } from '@/stores/agent-factory-ui-store';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

interface InstallResult {
  installed: string[];
  skipped: string[];
  errors: string[];
}

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ProjectSettingsDialog({ open, onOpenChange, projectId }: ProjectSettingsDialogProps) {
  const t = useTranslations('settings');
  const { projects } = useProjectStore();
  const { setOpen: setAgentFactoryOpen } = useAgentFactoryUIStore();
  const {
    settings,
    isLoading,
    fetchProjectSettings,
    updateProjectSettings,
    installComponents,
    isInstalling,
  } = useProjectSettingsStore();
  const { toast } = useToast();

  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [selectedAgentSets, setSelectedAgentSets] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [actuallyInstalledIds, setActuallyInstalledIds] = useState<string[]>([]);

  // Track if we've loaded settings for this project to prevent overwriting user's selections
  const loadedProjectIdRef = useRef<string | null>(null);
  const fetchedProjectIdRef = useRef<string | null>(null);

  // Track installed components from filesystem (always use actual installed IDs)
  const installedComponentIds = actuallyInstalledIds;

  // Check if there are newly selected components that aren't installed yet
  const allSelected = [...selectedComponents, ...selectedAgentSets];
  const hasPendingInstall = installResult && allSelected.some(id => !installedComponentIds.includes(id));
  useEffect(() => {
    if (open && projectId) {
      fetchProjectSettings(projectId);
      fetchInstalledComponents(projectId);
    }
  }, [open, projectId]);

  const fetchInstalledComponents = async (projectId: string) => {
    try {
      const response = await fetch(`/api/agent-factory/projects/${projectId}/installed`, {
        headers: {
          'x-api-key': localStorage.getItem('apiKey') || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActuallyInstalledIds(data.installed || []);
      }
    } catch (error) {
      console.error('Error fetching installed components:', error);
    }
  };

  // Update local state when settings are loaded (only on initial load or projectId change)
  useEffect(() => {
    if (projectId && settings[projectId] && loadedProjectIdRef.current !== projectId) {
      const s = settings[projectId];
      setSelectedComponents(s.selectedComponents || []);
      setSelectedAgentSets(s.selectedAgentSets || []);
      setHasChanges(false);
      loadedProjectIdRef.current = projectId;
    }
  }, [projectId, settings]);

  const handleSave = async () => {
    try {
      // Update settings
      await updateProjectSettings(projectId, {
        selectedComponents,
        selectedAgentSets,
      });

      // Install components to project folder
      const result = await installComponents(projectId);
      setInstallResult(result);

      // Refresh installed status from filesystem after installation
      await fetchInstalledComponents(projectId);

      if (result.errors.length > 0) {
        toast({
          title: 'Installation completed with errors',
          description: `${result.installed.length} installed, ${result.errors.length} failed`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Installation successful',
          description: `${result.installed.length} components installed to project`,
        });
      }

      setHasChanges(false);
      // Don't close dialog so user can see the installation result
    } catch (error) {
      console.error('Failed to install components:', error);
      toast({
        title: 'Error',
        description: 'Failed to install components',
        variant: 'destructive',
      });
    }
  };

  const handleDone = () => {
    setInstallResult(null);
    onOpenChange(false);
  };

  const handleRefresh = async () => {
    if (projectId) {
      await fetchProjectSettings(projectId);
      await fetchInstalledComponents(projectId);
    }
  };

  const selectedProject = projects.find(p => p.id === projectId);

  if (projects.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('projectSettings')}</DialogTitle>
            <DialogDescription>{t('noProjectsAvailable')}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {selectedProject?.name || t('projectSettings')}
          </DialogTitle>
          <DialogDescription>
            Configure plugins and agent sets for this project
          </DialogDescription>
        </DialogHeader>

        {/* Project settings content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {/* Project info */}
              <div className="space-y-2">
                <Label>Project Path</Label>
                <Input value={selectedProject?.path || ''} readOnly className="font-mono text-sm" />
              </div>

              {/* Installation status */}
              {installResult && (
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Installation Complete</span>
                  </div>

                  {installResult.installed.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-700">Installed ({installResult.installed.length})</p>
                      <ScrollArea className="h-24 border rounded-md p-2">
                        <ul className="text-xs space-y-1">
                          {installResult.installed.map((item, i) => (
                            <li key={i} className="text-muted-foreground">• {item}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}

                  {installResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-red-700">Errors ({installResult.errors.length})</p>
                      <ScrollArea className="h-24 border rounded-md p-2 bg-red-50">
                        <ul className="text-xs space-y-1">
                          {installResult.errors.map((item, i) => (
                            <li key={i} className="text-red-600">• {item}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}

                  {installResult.skipped.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-yellow-700">Skipped ({installResult.skipped.length})</p>
                      <ul className="text-xs space-y-1">
                        {installResult.skipped.map((item, i) => (
                          <li key={i} className="text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Plugins section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Plugins</Label>
                  <button
                    onClick={() => {
                      setAgentFactoryOpen(true);
                      onOpenChange(false);
                    }}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Manage in Agent Factory
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                <ComponentSelector
                  type="component"
                  selectedIds={selectedComponents}
                  onChange={(ids) => {
                    setSelectedComponents(ids);
                    setHasChanges(true);
                  }}
                  projectId={projectId}
                  installedIds={installedComponentIds}
                  onRefresh={handleRefresh}
                  onCloseDialog={() => onOpenChange(false)}
                />
              </div>

              {/* Agent sets section */}
              <div className="space-y-2">
                <Label>Agent Sets</Label>
                <ComponentSelector
                  type="agent_set"
                  selectedIds={selectedAgentSets}
                  onChange={(ids) => {
                    setSelectedAgentSets(ids);
                    setHasChanges(true);
                  }}
                  projectId={projectId}
                  installedIds={installedComponentIds}
                  onRefresh={handleRefresh}
                  onCloseDialog={() => onOpenChange(false)}
                />
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          {installResult && !hasPendingInstall ? (
            <Button onClick={handleDone}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isInstalling || isLoading}
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Install
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
