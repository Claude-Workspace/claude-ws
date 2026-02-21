'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Key, LogIn, CreditCard, AlertCircle, Loader2, RotateCcw, Check, Settings, Eye, EyeOff } from 'lucide-react';
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
  API_TIMEOUT_MS: '3000000',
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

  return authErrorPatterns.some(pattern =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

type ProviderOption = 'oauth' | 'console' | 'settings' | 'custom';

interface AgentProviderSetupFormProps {
  onComplete?: () => void;
}

export function AgentProviderSetupForm({ onComplete }: AgentProviderSetupFormProps) {
  const t = useTranslations('agentProvider');
  const tCommon = useTranslations('common');
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

  // Load saved config on mount
  useEffect(() => {
    setLoadingConfig(true);
    fetch('/api/settings/provider')
      .then(res => res.json())
      .then(data => {
        if (data.providers) {
          setProviders(data.providers);
        }
        if (data.appEnvConfig) {
          setAppEnvConfig(data.appEnvConfig);
          setConfig({
            ANTHROPIC_AUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: data.appEnvConfig.ANTHROPIC_BASE_URL || '',
            ANTHROPIC_PROXIED_BASE_URL: data.appEnvConfig.ANTHROPIC_PROXIED_BASE_URL || '',
            ANTHROPIC_MODEL: data.appEnvConfig.ANTHROPIC_MODEL || '',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: data.appEnvConfig.ANTHROPIC_DEFAULT_HAIKU_MODEL || '',
            ANTHROPIC_DEFAULT_SONNET_MODEL: data.appEnvConfig.ANTHROPIC_DEFAULT_SONNET_MODEL || '',
            ANTHROPIC_DEFAULT_OPUS_MODEL: data.appEnvConfig.ANTHROPIC_DEFAULT_OPUS_MODEL || '',
            API_TIMEOUT_MS: data.appEnvConfig.API_TIMEOUT_MS || '',
          });
          setHasExistingKey(!!data.appEnvConfig.ANTHROPIC_AUTH_TOKEN);
        }
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
  }, []);

  const handleOptionSelect = (option: ProviderOption) => {
    setSelectedOption(option);
    setError('');
  };

  const handleToggleProcessEnv = async () => {
    if (showProcessEnv) {
      setShowProcessEnv(false);
    } else {
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
    window.open('https://claude.ai/login', '_blank');
    setError(t('afterLoginHint'));
  };

  const handleConsoleSetup = () => {
    window.open('https://console.anthropic.com/settings/keys', '_blank');
    setSelectedOption('custom');
  };

  const handleUseDefaults = () => {
    setConfig(prev => ({
      ...prev,
      ANTHROPIC_BASE_URL: DEFAULT_CONFIG.ANTHROPIC_BASE_URL,
      ANTHROPIC_PROXIED_BASE_URL: DEFAULT_CONFIG.ANTHROPIC_PROXIED_BASE_URL,
      ANTHROPIC_MODEL: DEFAULT_CONFIG.ANTHROPIC_MODEL,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: DEFAULT_CONFIG.ANTHROPIC_DEFAULT_HAIKU_MODEL,
      ANTHROPIC_DEFAULT_SONNET_MODEL: DEFAULT_CONFIG.ANTHROPIC_DEFAULT_SONNET_MODEL,
      ANTHROPIC_DEFAULT_OPUS_MODEL: DEFAULT_CONFIG.ANTHROPIC_DEFAULT_OPUS_MODEL
    }));
  };

  const handleConfigChange = (key: keyof ProviderConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleCustomKeySubmit = async () => {
    if (!config.ANTHROPIC_AUTH_TOKEN.trim() && !hasExistingKey) {
      setError('API key is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const finalConfig: Record<string, string> = {
        ANTHROPIC_BASE_URL: config.ANTHROPIC_BASE_URL || DEFAULT_CONFIG.ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: config.ANTHROPIC_MODEL || DEFAULT_CONFIG.ANTHROPIC_MODEL,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: config.ANTHROPIC_DEFAULT_HAIKU_MODEL || DEFAULT_CONFIG.ANTHROPIC_DEFAULT_HAIKU_MODEL,
        ANTHROPIC_DEFAULT_SONNET_MODEL: config.ANTHROPIC_DEFAULT_SONNET_MODEL || DEFAULT_CONFIG.ANTHROPIC_DEFAULT_SONNET_MODEL,
        ANTHROPIC_DEFAULT_OPUS_MODEL: config.ANTHROPIC_DEFAULT_OPUS_MODEL || DEFAULT_CONFIG.ANTHROPIC_DEFAULT_OPUS_MODEL,
      };

      if (config.API_TIMEOUT_MS) {
        finalConfig.API_TIMEOUT_MS = config.API_TIMEOUT_MS;
      }

      if (config.ANTHROPIC_PROXIED_BASE_URL) {
        finalConfig.ANTHROPIC_PROXIED_BASE_URL = config.ANTHROPIC_PROXIED_BASE_URL;
      }

      if (config.ANTHROPIC_AUTH_TOKEN.trim()) {
        finalConfig.ANTHROPIC_AUTH_TOKEN = config.ANTHROPIC_AUTH_TOKEN;
      }

      const res = await fetch('/api/settings/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: finalConfig, skipKeyIfMissing: hasExistingKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      if (onComplete) {
        onComplete();
      } else {
        window.location.reload();
      }
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

      if (onComplete) {
        onComplete();
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleReload = () => {
    if (onComplete) {
      onComplete();
    } else {
      window.location.reload();
    }
  };

  const handleBack = () => {
    setSelectedOption(null);
    setError('');
    setShowDismissConfirm(false);
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
    <div>
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
                  <span className="font-medium">{t('loginWithClaude')}</span>
                  {providers.oauth.configured && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      {tCommon('configured')}
                    </span>
                  )}
                  {providers.oauth.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {tCommon('default')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {t('forClaudeSubscribers')}
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
                  <span className="font-medium">{t('anthropicConsole')}</span>
                  {providers.console.configured && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      {tCommon('configured')}
                    </span>
                  )}
                  {providers.console.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {tCommon('default')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {t('payAsYouGo')}
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
                  <span className="font-medium">{t('claudeCodeSettings')}</span>
                  {providers.settings.configured && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      {tCommon('configured')}
                    </span>
                  )}
                  {providers.settings.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {tCommon('default')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {t('useSettingsJson')}
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
                  <span className="font-medium">{t('customApiKey')}</span>
                  {providers.custom.configured && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      {tCommon('configured')}
                    </span>
                  )}
                  {providers.custom.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {tCommon('default')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {t('useOwnApiKey')}
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
              {loadingProcessEnv ? t('loading') : showProcessEnv ? t('hideConfig') : t('reloadShowConfig')} {t('currentConfiguration')}
            </Button>

            {showProcessEnv && (
              <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs font-mono space-y-1">
                <div className="text-muted-foreground mb-2 font-sans text-sm font-medium">
                  {t('activeProcessEnv')}
                </div>
                {Object.keys(processEnvConfig).length === 0 ? (
                  <div className="text-muted-foreground italic">{t('noProviderConfig')}</div>
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
            <h4 className="font-medium mb-2">{t('howToLoginOAuth')}</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>{t('ensureSubscription')}</li>
              <li>{t('openTerminal')}</li>
              <li>{t('runClaudeLogin')} <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">claude /login</code></li>
              <li>{t('chooseOAuthOption')}</li>
              <li>{t('followAuthFlow')}</li>
              <li>{t('restartAfterLogin')}</li>
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
              {tCommon('back')}
            </Button>
            <Button onClick={handleReload} className="flex-1">
              {t('loggedInReload')}
            </Button>
          </div>
        </div>
      ) : selectedOption === 'console' ? (
        // Console setup view
        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium mb-2">{t('howToUseConsole')}</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>{t('ensureSubscription')}</li>
              <li>{t('openTerminal')}</li>
              <li>{t('runClaudeLogin')} <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">claude /login</code></li>
              <li>{t('chooseConsoleOption')}</li>
              <li>{t('followAuthFlow')}</li>
              <li>{t('restartAfterLogin')}</li>
            </ol>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleBack} className="flex-1">
              {tCommon('back')}
            </Button>
            <Button onClick={handleReload} className="flex-1">
              {t('loggedInReload')}
            </Button>
          </div>
        </div>
      ) : selectedOption === 'settings' ? (
        // Settings.json info view
        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium mb-2">{t('usingClaudeCodeSettings')}</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('settingsFileDescription')}
              </p>
              <ul className="list-disc list-inside pl-2 space-y-1 text-xs">
                <li><strong>{t('linuxMacOs')}</strong> <code className="px-1 rounded bg-muted font-mono">~/.claude/settings.json</code></li>
                <li><strong>{t('windows')}</strong> <code className="px-1 rounded bg-muted font-mono">%USERPROFILE%\.claude\settings.json</code></li>
              </ul>
              <p className="mt-2">{t('envVarsDescription')}</p>
              <ul className="list-disc list-inside pl-2 space-y-1 text-xs">
                <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_AUTH_TOKEN</code> <span className="text-destructive">{t('required')}</span></li>
                <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_MODEL</code></li>
                <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_BASE_URL</code></li>
                <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_DEFAULT_HAIKU_MODEL</code></li>
                <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_DEFAULT_SONNET_MODEL</code></li>
                <li><code className="px-1 rounded bg-muted font-mono">ANTHROPIC_DEFAULT_OPUS_MODEL</code></li>
                <li><code className="px-1 rounded bg-muted font-mono">API_TIMEOUT_MS</code></li>
              </ul>
              {providers.settings.configured ? (
                <p className="text-green-600 dark:text-green-400 mt-2">
                  ✓ {t('settingsConfigured')}
                </p>
              ) : (
                <p className="text-amber-600 dark:text-amber-400 mt-2">
                  {t('settingsNotConfigured')}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleBack} className="flex-1">
              {tCommon('back')}
            </Button>
            <Button onClick={handleReload} className="flex-1">
              {t('reloadToApply')}
            </Button>
          </div>
        </div>
      ) : (
        // Custom key input view
        <div className="space-y-4 py-4">
          {/* API Key - Required */}
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-sm font-medium">
              {t('customApiKey')} {!hasExistingKey && <span className="text-destructive">*</span>}
            </Label>
            <div className="relative">
              <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="api-key"
                type="password"
                value={config.ANTHROPIC_AUTH_TOKEN}
                onChange={(e) => handleConfigChange('ANTHROPIC_AUTH_TOKEN', e.target.value)}
                placeholder={hasExistingKey ? t('leaveEmptyToKeep') : "Enter API key..."}
                className="pl-8"
                disabled={loading}
                autoFocus
              />
            </div>
            {hasExistingKey && (
              <p className="text-xs text-muted-foreground">
                {t('existingKeyHint')}
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
            {t('fillDefaultValues')}
          </Button>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="base-url" className="text-sm font-medium">
              {t('baseUrl')}
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
              {t('defaultModel')}
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
                {t('haikuModel')}
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
                {t('sonnetModel')}
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
                {t('opusModel')}
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
              {t('apiTimeout')}
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
            {t('configSavedToEnv')}
          </p>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleBack} disabled={loading}>
              {tCommon('back')}
            </Button>
            {hasExistingKey && !showDismissConfirm && (
              <Button
                variant="destructive"
                onClick={() => setShowDismissConfirm(true)}
                disabled={loading}
              >
                {t('dismissProvider')}
              </Button>
            )}
            {showDismissConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">{t('areYouSure')}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDismissConfirm(false)}
                  disabled={loading}
                >
                  {tCommon('no')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDismissMethod}
                  disabled={loading}
                >
                  {t('yesDismiss')}
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
                    {tCommon('saving')}
                  </>
                ) : (
                  t('saveConfiguration')
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AgentProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentProviderDialog({ open, onOpenChange }: AgentProviderDialogProps) {
  const t = useTranslations('agentProvider');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] z-[9999] max-h-[90vh] overflow-y-auto !grid !grid-rows-[auto_1fr]">
        <DialogHeader>
          <DialogTitle>{t('configureTitle')}</DialogTitle>
          <DialogDescription>
            {t('configureDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 -mx-6 px-6">
          {open && (
            <AgentProviderSetupForm
              onComplete={() => {
                onOpenChange(false);
                window.location.reload();
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
