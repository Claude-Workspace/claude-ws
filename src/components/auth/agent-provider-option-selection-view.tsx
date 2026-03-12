'use client';

import { useTranslations } from 'next-intl';
import { LogIn, CreditCard, Key, Settings, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgentProviderOptionCard } from '@/components/auth/agent-provider-option-card';

type ProviderOption = 'oauth' | 'console' | 'settings' | 'custom';

interface ProviderStatus {
  configured: boolean;
  isDefault: boolean;
}

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

interface AgentProviderOptionSelectionViewProps {
  providers: Record<ProviderOption, ProviderStatus>;
  onOptionSelect: (option: ProviderOption) => void;
  showProcessEnv: boolean;
  loadingProcessEnv: boolean;
  processEnvConfig: Record<string, string>;
  onToggleProcessEnv: () => void;
}

/**
 * Displays the four provider option cards and an expandable process-env config panel.
 * Used as the initial view in AgentProviderSetupForm before a provider is chosen.
 */
export function AgentProviderOptionSelectionView({
  providers,
  onOptionSelect,
  showProcessEnv,
  loadingProcessEnv,
  processEnvConfig,
  onToggleProcessEnv,
}: AgentProviderOptionSelectionViewProps) {
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
