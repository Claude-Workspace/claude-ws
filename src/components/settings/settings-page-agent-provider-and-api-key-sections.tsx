'use client';

import { useTranslations } from 'next-intl';
import { Bot, Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dispatchAgentProviderConfig } from '@/components/auth/agent-provider-dialog';
import { ApiAccessKeySetupForm } from '@/components/access-anywhere/api-access-key-setup-modal';

interface SettingsPageProviderAndApiKeySectionsProps {
  loadingStatus: boolean;
  agentProviderConfigured: boolean;
  apiAccessKeyConfigured: boolean;
  onApiKeyConfigured: () => void;
}

/**
 * Two settings sections rendered inside SettingsPage:
 * 1. Agent Provider (Claude API config) with configure button
 * 2. API Access Key (remote auth) with inline setup form
 */
export function SettingsPageProviderAndApiKeySections({
  loadingStatus,
  agentProviderConfigured,
  apiAccessKeyConfigured,
  onApiKeyConfigured,
}: SettingsPageProviderAndApiKeySectionsProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  return (
    <>
      {/* Agent Provider Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{tCommon('agentProvider')}</h2>
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{t('claudeApiConfig')}</p>
                <p className="text-sm text-muted-foreground">
                  {loadingStatus
                    ? tCommon('checking')
                    : agentProviderConfigured
                      ? t('providerConfigured')
                      : t('noProviderConfigured')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!loadingStatus && agentProviderConfigured && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" />
                  {tCommon('configured')}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => dispatchAgentProviderConfig()}>
                {t('configure')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* API Access Key Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('apiAccessKey')}</h2>
        <div className="p-4 border rounded-lg bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{t('remoteAccessAuth')}</p>
                <p className="text-sm text-muted-foreground">
                  {loadingStatus
                    ? tCommon('checking')
                    : apiAccessKeyConfigured
                      ? t('apiKeyConfigured')
                      : t('noApiKeyConfigured')}
                </p>
              </div>
            </div>
            {!loadingStatus && apiAccessKeyConfigured && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="h-3 w-3" />
                {tCommon('configured')}
              </span>
            )}
          </div>
          <ApiAccessKeySetupForm onSuccess={onApiKeyConfigured} />
        </div>
      </div>
    </>
  );
}
