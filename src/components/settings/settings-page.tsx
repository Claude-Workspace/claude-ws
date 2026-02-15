'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, FolderOpen, X, Bot, Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjectStore } from '@/stores/project-store';
import { useSettingsUIStore } from '@/stores/settings-ui-store';
import { dispatchAgentProviderConfig } from '@/components/auth/agent-provider-dialog';
import { ApiAccessKeySetupForm } from '@/components/access-anywhere/api-access-key-setup-modal';

export function SettingsPage() {
  const { currentProject, updateProject } = useProjectStore();
  const { setOpen: setSettingsOpen } = useSettingsUIStore();
  const [editingName, setEditingName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [autoCompactEnabled, setAutoCompactEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/settings?keys=auto_compact_enabled')
      .then((res) => res.json())
      .then((data) => {
        if (data.auto_compact_enabled === 'true') {
          setAutoCompactEnabled(true);
        }
      });
  }, []);

  const handleAutoCompactToggle = async (checked: boolean) => {
    setAutoCompactEnabled(checked);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'auto_compact_enabled', value: String(checked) }),
    });
  };

  const [agentProviderConfigured, setAgentProviderConfigured] = useState(false);
  const [apiAccessKeyConfigured, setApiAccessKeyConfigured] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      setLoadingStatus(true);
      try {
        const [providerRes, apiKeyRes] = await Promise.allSettled([
          fetch('/api/settings/provider').then(r => r.json()),
          fetch('/api/settings/api-access-key').then(r => r.json()),
        ]);

        if (providerRes.status === 'fulfilled') {
          const providers = providerRes.value.providers;
          setAgentProviderConfigured(!!(
            providers?.custom?.configured ||
            providers?.settings?.configured ||
            providers?.console?.configured ||
            providers?.oauth?.configured
          ));
        }

        if (apiKeyRes.status === 'fulfilled') {
          setApiAccessKeyConfigured(!!apiKeyRes.value.configured);
        }
      } catch {
        // Ignore
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchStatus();
  }, []);

  const handleSaveName = async () => {
    if (!currentProject || !editingName.trim()) return;
    await updateProject(currentProject.id, { name: editingName.trim() });
    setIsEditing(false);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(false)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6" />
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setSettingsOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Settings Sections */}
      <div className="max-w-2xl space-y-6">
        {/* Current Project Section */}
        {currentProject && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Current Project</h2>
            <div className="space-y-3 p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-9"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveName}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium text-lg">{currentProject.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingName(currentProject.name);
                        setIsEditing(true);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>
              <div className="pl-8">
                <p className="text-sm text-muted-foreground">{currentProject.path}</p>
              </div>
            </div>
          </div>
        )}

        {/* Context Management Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Context Management</h2>
          <div className="space-y-3 p-4 border rounded-lg bg-card">
            <div className="flex items-start gap-3">
              <Checkbox
                id="auto-compact"
                checked={autoCompactEnabled}
                onCheckedChange={(checked) => handleAutoCompactToggle(checked === true)}
              />
              <div className="space-y-1">
                <label htmlFor="auto-compact" className="font-medium leading-none cursor-pointer">
                  Auto-compact conversations
                </label>
                <p className="text-sm text-muted-foreground">
                  Automatically compact conversation context when it exceeds 75% of the context window
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Provider Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Agent Provider</h2>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Claude API Configuration</p>
                  <p className="text-sm text-muted-foreground">
                    {loadingStatus
                      ? 'Checking...'
                      : agentProviderConfigured
                        ? 'A provider is configured'
                        : 'No provider configured'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!loadingStatus && agentProviderConfigured && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <Check className="h-3 w-3" />
                    Configured
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dispatchAgentProviderConfig()}
                >
                  Configure
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* API Access Key Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">API Access Key</h2>
          <div className="p-4 border rounded-lg bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Remote Access Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    {loadingStatus
                      ? 'Checking...'
                      : apiAccessKeyConfigured
                        ? 'An API access key is configured'
                        : 'No API access key configured'
                    }
                  </p>
                </div>
              </div>
              {!loadingStatus && apiAccessKeyConfigured && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" />
                  Configured
                </span>
              )}
            </div>
            <ApiAccessKeySetupForm
              onSuccess={() => setApiAccessKeyConfigured(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
