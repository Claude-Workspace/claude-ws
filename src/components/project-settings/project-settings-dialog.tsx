'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Loader2, Download, ExternalLink } from 'lucide-react';
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
import { ComponentSelector } from '@/components/project-settings/component-selector';
import { useProjectSettingsStore } from '@/stores/project-settings-store';
import { useAgentFactoryUIStore } from '@/stores/agent-factory-ui-store';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { ProjectSettingsInstallResultPanel } from '@/components/project-settings/project-settings-install-result-panel';

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
  const { settings, isLoading, fetchProjectSettings, updateProjectSettings, installComponents, isInstalling } = useProjectSettingsStore();
  const { toast } = useToast();

  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [selectedAgentSets, setSelectedAgentSets] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [actuallyInstalledIds, setActuallyInstalledIds] = useState<string[]>([]);
  const loadedProjectIdRef = useRef<string | null>(null);

  const allSelected = [...selectedComponents, ...selectedAgentSets];
  const hasPendingInstall = installResult && allSelected.some(id => !actuallyInstalledIds.includes(id));

  useEffect(() => {
    if (open && projectId) { fetchProjectSettings(projectId); fetchInstalledComponents(projectId); }
  }, [open, projectId]);

  const fetchInstalledComponents = async (projId: string) => {
    try {
      const response = await fetch(`/api/agent-factory/projects/${projId}/installed`, {
        headers: { 'x-api-key': localStorage.getItem('apiKey') || '' },
      });
      if (response.ok) { const data = await response.json(); setActuallyInstalledIds(data.installed || []); }
    } catch (error) { console.error('Error fetching installed components:', error); }
  };

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
      await updateProjectSettings(projectId, { selectedComponents, selectedAgentSets });
      const result = await installComponents(projectId);
      setInstallResult(result);
      await fetchInstalledComponents(projectId);
      if (result.errors.length > 0) {
        toast({ title: 'Installation completed with errors', description: `${result.installed.length} installed, ${result.errors.length} failed`, variant: 'destructive' });
      } else {
        toast({ title: 'Installation successful', description: `${result.installed.length} components installed to project` });
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to install components:', error);
      toast({ title: 'Error', description: 'Failed to install components', variant: 'destructive' });
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
          <DialogDescription>Configure plugins and agent sets for this project</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Project Path</Label>
                <Input value={selectedProject?.path || ''} readOnly className="font-mono text-sm" />
              </div>

              {installResult && <ProjectSettingsInstallResultPanel installResult={installResult} />}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Plugins</Label>
                  <button onClick={() => { setAgentFactoryOpen(true); onOpenChange(false); }}
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    Manage in Agent Factory<ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                <ComponentSelector type="component" selectedIds={selectedComponents}
                  onChange={(ids) => { setSelectedComponents(ids); setHasChanges(true); }}
                  projectId={projectId} installedIds={actuallyInstalledIds}
                  onRefresh={() => { fetchProjectSettings(projectId); fetchInstalledComponents(projectId); }}
                  onCloseDialog={() => onOpenChange(false)} />
              </div>

              <div className="space-y-2">
                <Label>Agent Sets</Label>
                <ComponentSelector type="agent_set" selectedIds={selectedAgentSets}
                  onChange={(ids) => { setSelectedAgentSets(ids); setHasChanges(true); }}
                  projectId={projectId} installedIds={actuallyInstalledIds}
                  onRefresh={() => { fetchProjectSettings(projectId); fetchInstalledComponents(projectId); }}
                  onCloseDialog={() => onOpenChange(false)} />
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          {installResult && !hasPendingInstall ? (
            <Button onClick={() => { setInstallResult(null); onOpenChange(false); }}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!hasChanges || isInstalling || isLoading}>
                {isInstalling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Installing...</> : <><Download className="h-4 w-4 mr-2" />Install</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
