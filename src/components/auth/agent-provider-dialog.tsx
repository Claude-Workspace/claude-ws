'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Key, LogIn, CreditCard, AlertCircle, Loader2, RotateCcw, Check, Settings, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Default values for provider config
const DEFAULT_CONFIG = {
  ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
  ANTHROPIC_PROXIED_BASE_URL: '',  // Empty means use ANTHROPIC_BASE_URL directly
  ANTHROPIC_MODEL: 'opus',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'sonnet',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'opus',
  API_TIMEOUT_MS: '30000',
};

interface ProviderConfig {
  ANTHROPIC_AUTH_TOKEN: string;
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_PROXIED_BASE_URL: string;  // Target URL when using proxy
  ANTHROPIC_MODEL: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL: string;
  API_TIMEOUT_MS: string;
}

// Event name for triggering the dialog
export const AGENT_PROVIDER_CONFIG_EVENT = 'claude-kanban:agent-provider-config';

/**
 * Dispatch event to open the Agent Provider Config dialog
 */
export function dispatchAgentProviderConfig(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AGENT_PROVIDER_CONFIG_EVENT));
  }
}

/**
 * Check if an error message indicates an authentication/provider issue
 */
export function isProviderAuthError(errorMessage: string): boolean {
  const authErrorPatterns = [
    'Invalid API key',
    'Please run /login'
  ];
  // [
  //   'Invalid API key',
  //   'authentication_error',
  //   'OAuth authentication is currently not supported',
  //   'Please run /login',
  //   'No LLM config found',
  //   'Failed to authenticate',
  //   'API Error: 401',
  //   'Unauthorized',
  //   'invalid_api_key',
  //   'invalid x-api-key',
  // ];
  
  return authErrorPatterns.some(pattern =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

type ProviderOption = 'oauth' | 'console' | 'settings' | 'custom';

interface AgentProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentProviderDialog({ open, onOpenChange }: AgentProviderDialogProps) {
  const [selectedOption, setSelectedOption] = useState<ProviderOption | null>(null);
  const [config, setConfig] = useState<ProviderConfig>({
    ANTHROPIC_AUTH_TOKEN: '',
    ANTHROPIC_BASE_URL: '',
    ANTHROPIC_PROXIED_BASE_URL: '',
    ANTHROPIC_MODEL: '',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: '',
    ANTHROPIC_DEFAULT_SONNET_MODEL: '',
    ANTHROPIC_DEFAULT_OPUS_MODEL: '',
    API_TIMEOUT_MS: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<{
    custom: { configured: boolean; isDefault: boolean };
    settings: { configured: boolean; isDefault: boolean };
    console: { configured: boolean; isDefault: boolean };
    oauth: { configured: boolean; isDefault: boolean };
  }>({
    custom: { configured: false, isDefault: false },
    settings: { configured: false, isDefault: false },
    console: { configured: false, isDefault: false },
    oauth: { configured: false, isDefault: false },
  });
  const [showProcessEnv, setShowProcessEnv] = useState(false);
  const [loadingProcessEnv, setLoadingProcessEnv] = useState(false);
  const [processEnvConfig, setProcessEnvConfig] = useState<Record<string, string>>({});
  const [appEnvConfig, setAppEnvConfig] = useState<Record<string, string>>({});

  // Load saved config when dialog opens
  useEffect(() => {
    if (open) {
      // Reset state first
      setSelectedOption(null);
      setError('');
      setShowDismissConfirm(false);
      setConfig({
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: '',
        ANTHROPIC_PROXIED_BASE_URL: '',
        ANTHROPIC_MODEL: '',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: '',
        ANTHROPIC_DEFAULT_SONNET_MODEL: '',
        ANTHROPIC_DEFAULT_OPUS_MODEL: '',
        API_TIMEOUT_MS: '',
      });
      setHasExistingKey(false);
      setProviders({
        custom: { configured: false, isDefault: false },
        settings: { configured: false, isDefault: false },
        console: { configured: false, isDefault: false },
        oauth: { configured: false, isDefault: false },
      });
      setShowProcessEnv(false);
      setProcessEnvConfig({});
      setAppEnvConfig({});

      // Then load from API
      setLoadingConfig(true);
      fetch('/api/settings/provider')
        .then(res => res.json())
        .then(data => {
          // Update providers status
          if (data.providers) {
            setProviders(data.providers);
          }
          // Load config values from app's .env file (for Custom API Key form)
          if (data.appEnvConfig) {
            setAppEnvConfig(data.appEnvConfig);  // Store for use in handleBack
            setConfig({
              ANTHROPIC_AUTH_TOKEN: '',  // Never pre-fill sensitive token
              ANTHROPIC_BASE_URL: data.appEnvConfig.ANTHROPIC_BASE_URL || '',
              ANTHROPIC_PROXIED_BASE_URL: data.appEnvConfig.ANTHROPIC_PROXIED_BASE_URL || '',
              ANTHROPIC_MODEL: data.appEnvConfig.ANTHROPIC_MODEL || '',
              ANTHROPIC_DEFAULT_HAIKU_MODEL: data.appEnvConfig.ANTHROPIC_DEFAULT_HAIKU_MODEL || '',
              ANTHROPIC_DEFAULT_SONNET_MODEL: data.appEnvConfig.ANTHROPIC_DEFAULT_SONNET_MODEL || '',
              ANTHROPIC_DEFAULT_OPUS_MODEL: data.appEnvConfig.ANTHROPIC_DEFAULT_OPUS_MODEL || '',
              API_TIMEOUT_MS: data.appEnvConfig.API_TIMEOUT_MS || '',
            });
            // Track if there's an existing API key in app's .env
            setHasExistingKey(!!data.appEnvConfig.ANTHROPIC_AUTH_TOKEN);
          }
          // Store process.env config for "Show Current Configuration"
          if (data.processEnvConfig) {
            setProcessEnvConfig(data.processEnvConfig);
          }
        })
        .catch(() => {
          // Ignore errors loading config
        })
        .finally(() => {
          setLoadingConfig(false);
        });
    }
  }, [open]);

  const handleOptionSelect = (option: ProviderOption) => {
    setSelectedOption(option);
    setError('');
  };

  const handleToggleProcessEnv = async () => {
    if (showProcessEnv) {
      // Hide the panel
      setShowProcessEnv(false);
    } else {
      // Fetch fresh data and show the panel
      setLoadingProcessEnv(true);
      try {
        const res = await fetch('/api/settings/provider');
        const data = await res.json();
        if (data.processEnvConfig) {
          setProcessEnvConfig(data.processEnvConfig);
        }
      } catch {
        // Ignore fetch errors
      } finally {
        setLoadingProcessEnv(false);
        setShowProcessEnv(true);
      }
    }
  };

  const handleOAuthLogin = () => {
    // Open Claude login in new tab - user needs to run `claude login` in terminal
    window.open('https://claude.ai/login', '_blank');
    setError('After logging in on claude.ai, run "claude login" in your terminal to authenticate.');
  };

  const handleConsoleSetup = () => {
    // Open Anthropic Console
    window.open('https://console.anthropic.com/settings/keys', '_blank');
    setSelectedOption('custom'); // Switch to custom key input after opening console
  };

  const handleUseDefaults = () => {
    setConfig(prev => ({
      ...prev,
      ANTHROPIC_BASE_URL: DEFAULT_CONFIG.ANTHROPIC_BASE_URL,
      ANTHROPIC_PROXIED_BASE_URL: DEFAULT_CONFIG.ANTHROPIC_PROXIED_BASE_URL,
      ANTHROPIC_MODEL: DEFAULT_CONFIG.ANTHROPIC_MODEL,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: DEFAULT_CONFIG.ANTHROPIC_DEFAULT_HAIKU_MODEL,
      ANTHROPIC_DEFAULT_SONNET_MODEL: DEFAULT_CONFIG.ANTHROPIC_DEFAULT_SONNET_MODEL,
      ANTHROPIC_DEFAULT_OPUS_MODEL: DEFAULT_CONFIG.ANTHROPIC_DEFAULT_OPUS_MODEL,
      API_TIMEOUT_MS: DEFAULT_CONFIG.API_TIMEOUT_MS,
    }));
  };

  const handleConfigChange = (key: keyof ProviderConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleCustomKeySubmit = async () => {
    // API key is required only if there's no existing key
    if (!config.ANTHROPIC_AUTH_TOKEN.trim() && !hasExistingKey) {
      setError('API key is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Build config with defaults for empty fields
      const finalConfig: Record<string, string> = {
        ANTHROPIC_BASE_URL: config.ANTHROPIC_BASE_URL || DEFAULT_CONFIG.ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: config.ANTHROPIC_MODEL || DEFAULT_CONFIG.ANTHROPIC_MODEL,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: config.ANTHROPIC_DEFAULT_HAIKU_MODEL || DEFAULT_CONFIG.ANTHROPIC_DEFAULT_HAIKU_MODEL,
        ANTHROPIC_DEFAULT_SONNET_MODEL: config.ANTHROPIC_DEFAULT_SONNET_MODEL || DEFAULT_CONFIG.ANTHROPIC_DEFAULT_SONNET_MODEL,
        ANTHROPIC_DEFAULT_OPUS_MODEL: config.ANTHROPIC_DEFAULT_OPUS_MODEL || DEFAULT_CONFIG.ANTHROPIC_DEFAULT_OPUS_MODEL,
        API_TIMEOUT_MS: config.API_TIMEOUT_MS || DEFAULT_CONFIG.API_TIMEOUT_MS,
      };

      // Include proxied base URL if set (for custom endpoints like openrouter)
      if (config.ANTHROPIC_PROXIED_BASE_URL) {
        finalConfig.ANTHROPIC_PROXIED_BASE_URL = config.ANTHROPIC_PROXIED_BASE_URL;
      }

      // Only include API key if a new one was entered
      if (config.ANTHROPIC_AUTH_TOKEN.trim()) {
        finalConfig.ANTHROPIC_AUTH_TOKEN = config.ANTHROPIC_AUTH_TOKEN;
      }

      // Save to project's .env
      const res = await fetch('/api/settings/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: finalConfig, skipKeyIfMissing: hasExistingKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      // Success - reload to apply new settings
      onOpenChange(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleDismissMethod = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/settings/provider', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to dismiss configuration');
      }

      // Success - reload to apply changes
      onOpenChange(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedOption(null);
    setError('');
    setShowDismissConfirm(false);
    // Restore config from stored appEnvConfig
    setConfig({
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_BASE_URL: appEnvConfig.ANTHROPIC_BASE_URL || '',
      ANTHROPIC_PROXIED_BASE_URL: appEnvConfig.ANTHROPIC_PROXIED_BASE_URL || '',
      ANTHROPIC_MODEL: appEnvConfig.ANTHROPIC_MODEL || '',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: appEnvConfig.ANTHROPIC_DEFAULT_HAIKU_MODEL || '',
      ANTHROPIC_DEFAULT_SONNET_MODEL: appEnvConfig.ANTHROPIC_DEFAULT_SONNET_MODEL || '',
      ANTHROPIC_DEFAULT_OPUS_MODEL: appEnvConfig.ANTHROPIC_DEFAULT_OPUS_MODEL || '',
      API_TIMEOUT_MS: appEnvConfig.API_TIMEOUT_MS || '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] z-[9999] max-h-[90vh] overflow-y-auto !grid !grid-rows-[auto_1fr]">
        <DialogHeader>
          <DialogTitle>Configure Agent Provider</DialogTitle>
          <DialogDescription>
            Choose how you want to authenticate with Claude API:
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 -mx-6 px-6">
        {!selectedOption ? (
          // Option selection view
          <div className="space-y-3 py-4">
            {/* Option 1: OAuth */}
            <button
              onClick={() => handleOptionSelect('oauth')}
              className={cn(
                'w-full p-4 rounded-lg border text-left transition-colors',
                'hover:bg-accent hover:border-primary/50',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                providers.oauth.configured && 'border-green-500/50 bg-green-500/5'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  <LogIn className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Login with Claude Account</span>
                    {providers.oauth.configured && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check className="h-3 w-3" />
                        Configured
                      </span>
                    )}
                    {providers.oauth.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    For Claude Pro, Max, Team, or Enterprise subscribers
                  </div>
                </div>
              </div>
            </button>

            {/* Option 2: Console */}
            <button
              onClick={() => handleOptionSelect('console')}
              className={cn(
                'w-full p-4 rounded-lg border text-left transition-colors',
                'hover:bg-accent hover:border-primary/50',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                providers.console.configured && 'border-green-500/50 bg-green-500/5'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-orange-500/10 text-orange-500">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Anthropic Console Account</span>
                    {providers.console.configured && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check className="h-3 w-3" />
                        Configured
                      </span>
                    )}
                    {providers.console.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Pay-as-you-go API usage billing
                  </div>
                </div>
              </div>
            </button>

            {/* Option 3: Settings.json */}
            <button
              onClick={() => handleOptionSelect('settings')}
              className={cn(
                'w-full p-4 rounded-lg border text-left transition-colors',
                'hover:bg-accent hover:border-primary/50',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                providers.settings.configured && 'border-green-500/50 bg-green-500/5'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-blue-500/10 text-blue-500">
                  <Settings className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Claude Code Settings</span>
                    {providers.settings.configured && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check className="h-3 w-3" />
                        Configured
                      </span>
                    )}
                    {providers.settings.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Use settings.json configuration
                  </div>
                </div>
              </div>
            </button>

            {/* Option 4: Custom Key */}
            <button
              onClick={() => handleOptionSelect('custom')}
              className={cn(
                'w-full p-4 rounded-lg border text-left transition-colors',
                'hover:bg-accent hover:border-primary/50',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                providers.custom.configured && 'border-green-500/50 bg-green-500/5'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-green-500/10 text-green-500">
                  <Key className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Custom API Key</span>
                    {providers.custom.configured && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check className="h-3 w-3" />
                        Configured
                      </span>
                    )}
                    {providers.custom.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Use your own Anthropic API key
                  </div>
                </div>
              </div>
            </button>

            {/* Show Current Config Button */}
            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleProcessEnv}
                disabled={loadingProcessEnv}
                className="w-full justify-start text-muted-foreground"
              >
                {loadingProcessEnv ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : showProcessEnv ? (
                  <EyeOff className="h-4 w-4 mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                {loadingProcessEnv ? 'Loading...' : showProcessEnv ? 'Hide' : 'Show'} Current Configuration
              </Button>

              {showProcessEnv && (
                <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs font-mono space-y-1">
                  <div className="text-muted-foreground mb-2 font-sans text-sm font-medium">
                    Active process.env values:
                  </div>
                  {Object.keys(processEnvConfig).length === 0 ? (
                    <div className="text-muted-foreground italic">No provider configuration loaded</div>
                  ) : (
                    <>
                      {processEnvConfig.ANTHROPIC_AUTH_TOKEN && (
                        <div><span className="text-muted-foreground">ANTHROPIC_AUTH_TOKEN:</span> {processEnvConfig.ANTHROPIC_AUTH_TOKEN}</div>
                      )}
                      {processEnvConfig.ANTHROPIC_BASE_URL && (
                        <div><span className="text-muted-foreground">ANTHROPIC_BASE_URL:</span> {processEnvConfig.ANTHROPIC_BASE_URL}</div>
                      )}
                      {processEnvConfig.ANTHROPIC_PROXIED_BASE_URL && (
                        <div><span className="text-muted-foreground">ANTHROPIC_PROXIED_BASE_URL:</span> {processEnvConfig.ANTHROPIC_PROXIED_BASE_URL}</div>
                      )}
                      {processEnvConfig.ANTHROPIC_MODEL && (
                        <div><span className="text-muted-foreground">ANTHROPIC_MODEL:</span> {processEnvConfig.ANTHROPIC_MODEL}</div>
                      )}
                      {processEnvConfig.API_TIMEOUT_MS && (
                        <div><span className="text-muted-foreground">API_TIMEOUT_MS:</span> {processEnvConfig.API_TIMEOUT_MS}</div>
                      )}
                      {processEnvConfig.ANTHROPIC_DEFAULT_HAIKU_MODEL && (
                        <div><span className="text-muted-foreground">ANTHROPIC_DEFAULT_HAIKU_MODEL:</span> {processEnvConfig.ANTHROPIC_DEFAULT_HAIKU_MODEL}</div>
                      )}
                      {processEnvConfig.ANTHROPIC_DEFAULT_SONNET_MODEL && (
                        <div><span className="text-muted-foreground">ANTHROPIC_DEFAULT_SONNET_MODEL:</span> {processEnvConfig.ANTHROPIC_DEFAULT_SONNET_MODEL}</div>
                      )}
                      {processEnvConfig.ANTHROPIC_DEFAULT_OPUS_MODEL && (
                        <div><span className="text-muted-foreground">ANTHROPIC_DEFAULT_OPUS_MODEL:</span> {processEnvConfig.ANTHROPIC_DEFAULT_OPUS_MODEL}</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : selectedOption === 'oauth' ? (
          // OAuth instructions view
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">How to login with OAuth:</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Make sure you have a Claude Pro, Max, Team, or Enterprise subscription</li>
                <li>Open a terminal on your server</li>
                <li>Run: <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">claude /login</code></li>
                <li>Choose <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">1. Claude account with subscription · Pro, Max, Team, or Enterprise</code></li>
                <li>Follow the browser authentication flow</li>
                <li>Restart the application after login</li>
              </ol>
            </div>
            {error && (
              <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                I&apos;ve Logged In - Reload
              </Button>
            </div>
          </div>
        ) : selectedOption === 'console' ? (
          // Console setup view
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">How to use Anthropic Console account:</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Make sure you have a Claude Pro, Max, Team, or Enterprise subscription</li>
                <li>Open a terminal on your server</li>
                <li>Run: <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">claude /login</code></li>
                <li>Choose <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">2. Anthropic Console account · API usage billing</code></li>
                <li>Follow the browser authentication flow</li>
                <li>Restart the application after login</li>
              </ol>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                I&apos;ve Logged In - Reload
              </Button>
            </div>
          </div>
        ) : selectedOption === 'settings' ? (
          // Settings.json info view
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Using Claude Code Settings</h4>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  This method uses the configuration from your Claude Code settings file:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-1 text-xs">
                  <li><strong>Linux/macOS:</strong> <code className="px-1 rounded bg-muted font-mono">~/.claude/settings.json</code></li>
                  <li><strong>Windows:</strong> <code className="px-1 rounded bg-muted font-mono">%USERPROFILE%\.claude\settings.json</code></li>
                </ul>
                <p className="mt-2">The following environment variables are read from the <code className="px-1 rounded bg-muted font-mono text-xs">env</code> section:</p>
                <ul className="list-disc list-inside pl-2 space-y-1 text-xs">
                  <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_AUTH_TOKEN</code> <span className="text-destructive">*required</span></li>
                  <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_MODEL</code></li>
                  <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_BASE_URL</code></li>
                  <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_DEFAULT_HAIKU_MODEL</code></li>
                  <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_DEFAULT_SONNET_MODEL</code></li>
                  <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_DEFAULT_OPUS_MODEL</code></li>
                  <li><code className="px-1 rounded bg-muted font-mono">API_TIMEOUT_MS</code></li>
                </ul>
                {providers.settings.configured ? (
                  <p className="text-green-600 dark:text-green-400 mt-2">
                    ✓ Settings.json is configured and will be used for authentication.
                  </p>
                ) : (
                  <p className="text-amber-600 dark:text-amber-400 mt-2">
                    Settings.json does not contain ANTHROPIC_AUTH_TOKEN. Add it to use this method.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                Reload to Apply
              </Button>
            </div>
          </div>
        ) : (
          // Custom key input view
          <div className="space-y-4 py-4">
            {/* API Key - Required */}
            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-sm font-medium">
                API Key {!hasExistingKey && <span className="text-destructive">*</span>}
              </Label>
              <div className="relative">
                <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="api-key"
                  type="password"
                  value={config.ANTHROPIC_AUTH_TOKEN}
                  onChange={(e) => handleConfigChange('ANTHROPIC_AUTH_TOKEN', e.target.value)}
                  placeholder={hasExistingKey ? "Leave empty to keep existing key" : "Enter API key..."}
                  className="pl-8"
                  disabled={loading}
                  autoFocus
                />
              </div>
              {hasExistingKey && (
                <p className="text-xs text-muted-foreground">
                  An API key is already configured. Leave empty to keep it, or enter a new one to replace it.
                </p>
              )}
            </div>

            {/* Use Defaults Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseDefaults}
              className="w-full"
              disabled={loading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Fill Default Values
            </Button>

            {/* Base URL */}
            <div className="space-y-2">
              <Label htmlFor="base-url" className="text-sm font-medium">
                Base URL
              </Label>
              <Input
                id="base-url"
                type="text"
                value={config.ANTHROPIC_BASE_URL}
                onChange={(e) => handleConfigChange('ANTHROPIC_BASE_URL', e.target.value)}
                placeholder={DEFAULT_CONFIG.ANTHROPIC_BASE_URL}
                disabled={loading}
              />
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model" className="text-sm font-medium">
                Default Model
              </Label>
              <Input
                id="model"
                type="text"
                value={config.ANTHROPIC_MODEL}
                onChange={(e) => handleConfigChange('ANTHROPIC_MODEL', e.target.value)}
                placeholder={DEFAULT_CONFIG.ANTHROPIC_MODEL}
                disabled={loading}
              />
            </div>

            {/* Model variants in a grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="haiku-model" className="text-xs font-medium">
                  Haiku Model
                </Label>
                <Input
                  id="haiku-model"
                  type="text"
                  value={config.ANTHROPIC_DEFAULT_HAIKU_MODEL}
                  onChange={(e) => handleConfigChange('ANTHROPIC_DEFAULT_HAIKU_MODEL', e.target.value)}
                  placeholder={DEFAULT_CONFIG.ANTHROPIC_DEFAULT_HAIKU_MODEL}
                  disabled={loading}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sonnet-model" className="text-xs font-medium">
                  Sonnet Model
                </Label>
                <Input
                  id="sonnet-model"
                  type="text"
                  value={config.ANTHROPIC_DEFAULT_SONNET_MODEL}
                  onChange={(e) => handleConfigChange('ANTHROPIC_DEFAULT_SONNET_MODEL', e.target.value)}
                  placeholder={DEFAULT_CONFIG.ANTHROPIC_DEFAULT_SONNET_MODEL}
                  disabled={loading}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="opus-model" className="text-xs font-medium">
                  Opus Model
                </Label>
                <Input
                  id="opus-model"
                  type="text"
                  value={config.ANTHROPIC_DEFAULT_OPUS_MODEL}
                  onChange={(e) => handleConfigChange('ANTHROPIC_DEFAULT_OPUS_MODEL', e.target.value)}
                  placeholder={DEFAULT_CONFIG.ANTHROPIC_DEFAULT_OPUS_MODEL}
                  disabled={loading}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <Label htmlFor="timeout" className="text-sm font-medium">
                API Timeout (ms)
              </Label>
              <Input
                id="timeout"
                type="number"
                value={config.API_TIMEOUT_MS}
                onChange={(e) => handleConfigChange('API_TIMEOUT_MS', e.target.value)}
                placeholder={DEFAULT_CONFIG.API_TIMEOUT_MS}
                disabled={loading}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Configuration will be saved to .env file in the app directory. Empty fields will use default values.
            </p>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleBack} disabled={loading}>
                Back
              </Button>
              {hasExistingKey && !showDismissConfirm && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDismissConfirm(true)}
                  disabled={loading}
                >
                  Dismiss This Provider
                </Button>
              )}
              {showDismissConfirm && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive">Are you sure?</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDismissConfirm(false)}
                    disabled={loading}
                  >
                    No
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDismissMethod}
                    disabled={loading}
                  >
                    Yes, Dismiss
                  </Button>
                </div>
              )}
              {!showDismissConfirm && (
                <Button
                  onClick={handleCustomKeySubmit}
                  disabled={loading || (!config.ANTHROPIC_AUTH_TOKEN && !hasExistingKey)}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
