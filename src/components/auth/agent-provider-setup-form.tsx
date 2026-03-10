'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LogIn, CreditCard, Key, Settings, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgentProviderOptionCard } from '@/components/auth/agent-provider-option-card';
import { AgentProviderCustomKeyForm, DEFAULT_CONFIG, type ProviderConfig } from '@/components/auth/agent-provider-custom-key-form';
import {
  OAuthInstructionView,
  ConsoleInstructionView,
  SettingsInstructionView,
} from '@/components/auth/agent-provider-instruction-views';

type ProviderOption = 'oauth' | 'console' | 'settings' | 'custom';

interface ProviderStatus {
  configured: boolean;
  isDefault: boolean;
}

interface AgentProviderSetupFormProps {
  onComplete?: () => void;
}

export function AgentProviderSetupForm({ onComplete }: AgentProviderSetupFormProps) {
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
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<Record<ProviderOption, ProviderStatus>>({
    custom: { configured: false, isDefault: false },
    settings: { configured: false, isDefault: false },
    console: { configured: false, isDefault: false },
    oauth: { configured: false, isDefault: false },
  });
  const [showProcessEnv, setShowProcessEnv] = useState(false);
  const [loadingProcessEnv, setLoadingProcessEnv] = useState(false);
  const [processEnvConfig, setProcessEnvConfig] = useState<Record<string, string>>({});
  const [appEnvConfig, setAppEnvConfig] = useState<Record<string, string>>({});

  useEffect(() => {
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
      const res = await fetch('/api/settings/provider', { method: 'DELETE' });

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

  if (!selectedOption) {
    return (
      <div>
        <OptionSelectionView
          providers={providers}
          onOptionSelect={handleOptionSelect}
          showProcessEnv={showProcessEnv}
          loadingProcessEnv={loadingProcessEnv}
          processEnvConfig={processEnvConfig}
          onToggleProcessEnv={handleToggleProcessEnv}
        />
      </div>
    );
  }

  if (selectedOption === 'oauth') {
    return <OAuthInstructionView error={error} onBack={handleBack} onReload={handleReload} />;
  }

  if (selectedOption === 'console') {
    return <ConsoleInstructionView onBack={handleBack} onReload={handleReload} />;
  }

  if (selectedOption === 'settings') {
    return (
      <SettingsInstructionView
        settingsConfigured={providers.settings.configured}
        onBack={handleBack}
        onReload={handleReload}
      />
    );
  }

  return (
    <AgentProviderCustomKeyForm
      config={config}
      loading={loading}
      hasExistingKey={hasExistingKey}
      showDismissConfirm={showDismissConfirm}
      error={error}
      onConfigChange={handleConfigChange}
      onUseDefaults={handleUseDefaults}
      onSubmit={handleCustomKeySubmit}
      onDismiss={handleDismissMethod}
      onShowDismissConfirm={setShowDismissConfirm}
      onBack={handleBack}
    />
  );
}

// Internal sub-component for option selection with process env display
const PROCESS_ENV_KEYS = [
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_PROXIED_BASE_URL',
  'ANTHROPIC_MODEL',
  'API_TIMEOUT_MS',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
] as const;

const PROVIDER_OPTIONS: Array<{
  key: ProviderOption;
  icon: typeof LogIn;
  iconClassName: string;
  titleKey: string;
  descriptionKey: string;
}> = [
  { key: 'oauth', icon: LogIn, iconClassName: 'bg-primary/10 text-primary', titleKey: 'loginWithClaude', descriptionKey: 'forClaudeSubscribers' },
  { key: 'console', icon: CreditCard, iconClassName: 'bg-orange-500/10 text-orange-500', titleKey: 'anthropicConsole', descriptionKey: 'payAsYouGo' },
  { key: 'settings', icon: Settings, iconClassName: 'bg-blue-500/10 text-blue-500', titleKey: 'claudeCodeSettings', descriptionKey: 'useSettingsJson' },
  { key: 'custom', icon: Key, iconClassName: 'bg-green-500/10 text-green-500', titleKey: 'customApiKey', descriptionKey: 'useOwnApiKey' },
];

interface OptionSelectionViewProps {
  providers: Record<ProviderOption, ProviderStatus>;
  onOptionSelect: (option: ProviderOption) => void;
  showProcessEnv: boolean;
  loadingProcessEnv: boolean;
  processEnvConfig: Record<string, string>;
  onToggleProcessEnv: () => void;
}

function OptionSelectionView({
  providers,
  onOptionSelect,
  showProcessEnv,
  loadingProcessEnv,
  processEnvConfig,
  onToggleProcessEnv,
}: OptionSelectionViewProps) {
  const t = useTranslations('agentProvider');

  return (
    <div className="space-y-3 py-4">
      {PROVIDER_OPTIONS.map(({ key, icon, iconClassName, titleKey, descriptionKey }) => (
        <AgentProviderOptionCard
          key={key}
          icon={icon}
          iconClassName={iconClassName}
          title={t(titleKey)}
          description={t(descriptionKey)}
          configured={providers[key].configured}
          isDefault={providers[key].isDefault}
          onClick={() => onOptionSelect(key)}
        />
      ))}

      <div className="pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleProcessEnv}
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
                {PROCESS_ENV_KEYS.map(key =>
                  processEnvConfig[key] ? (
                    <div key={key}><span className="text-muted-foreground">{key}:</span> {processEnvConfig[key]}</div>
                  ) : null
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
