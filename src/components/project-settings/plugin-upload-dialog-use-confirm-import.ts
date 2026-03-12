/**
 * Custom hook encapsulating the multi-step confirm-import flow for the project-settings
 * plugin upload dialog. Handles: agent-factory import → fetch IDs → update project
 * settings → sync to project folder.
 */

import { useCallback } from 'react';

interface PreviewItem {
  name: string;
}

interface UseConfirmImportParams {
  sessionId: string | null;
  projectId: string;
  previewItems: PreviewItem[];
  setStep: (step: 'upload' | 'preview' | 'importing') => void;
  setError: (error: string | null) => void;
  onSuccess: () => void;
  resetState: () => void;
  onOpenChange: (open: boolean) => void;
}

export function usePluginUploadConfirmImport({
  sessionId,
  projectId,
  previewItems,
  setStep,
  setError,
  onSuccess,
  resetState,
  onOpenChange,
}: UseConfirmImportParams) {
  const handleConfirmImport = useCallback(async () => {
    if (!sessionId) {
      setError('Session expired. Please upload the file again.');
      return;
    }
    setStep('importing');
    setError(null);
    try {
      // Step 1: Import to agent factory to get plugin IDs in database
      const importRes = await fetch('/api/agent-factory/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, confirm: true, globalImport: false }),
      });
      if (!importRes.ok) {
        const data = await importRes.json();
        throw new Error(data.error || 'Failed to import plugins');
      }

      // Step 2: Fetch plugins to get IDs matching the imported names
      const pluginsRes = await fetch('/api/agent-factory/plugins', {
        headers: { 'x-api-key': localStorage.getItem('apiKey') || '' },
      });
      if (!pluginsRes.ok) throw new Error('Failed to fetch plugins after import');
      const pluginsData = await pluginsRes.json();
      const importedNames = previewItems.map(item => item.name);
      const matchedPluginIds: string[] = (pluginsData.plugins || [])
        .filter((p: { name: string }) => importedNames.includes(p.name))
        .map((p: { id: string }) => p.id);
      if (matchedPluginIds.length === 0) throw new Error('No plugins found after import. Please try again.');

      // Step 3: Merge new IDs into current project settings
      const currentSettingsRes = await fetch(`/api/projects/${projectId}/settings`, {
        headers: { 'x-api-key': localStorage.getItem('apiKey') || '' },
      });
      let currentComponents: string[] = [];
      let currentAgentSets: string[] = [];
      if (currentSettingsRes.ok) {
        const s = await currentSettingsRes.json();
        currentComponents = s.settings?.selectedComponents || [];
        currentAgentSets = s.settings?.selectedAgentSets || [];
      }
      const newComponents = [...new Set([...currentComponents, ...matchedPluginIds])];

      // Step 4: Update project settings
      const updateRes = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('apiKey') || '' },
        body: JSON.stringify({ settings: { selectedComponents: newComponents, selectedAgentSets: currentAgentSets } }),
      });
      if (!updateRes.ok) console.warn('Failed to update project settings, but import was successful');

      // Step 5: Sync components to project folder
      const syncRes = await fetch(`/api/agent-factory/projects/${projectId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('apiKey') || '' },
      });
      if (!syncRes.ok) console.warn('Failed to sync components to project folder, but import was successful');

      onOpenChange(false);
      resetState();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
      setStep('preview');
    }
  }, [sessionId, projectId, previewItems, setStep, setError, onSuccess, resetState, onOpenChange]);

  return { handleConfirmImport };
}
