'use client';

import { useTranslations } from 'next-intl';
import { Key, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_CONFIG = {
  ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
  ANTHROPIC_PROXIED_BASE_URL: '',
  ANTHROPIC_MODEL: 'opus',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'sonnet',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'opus',
  API_TIMEOUT_MS: '3000000',
};

export interface ProviderConfig {
  ANTHROPIC_AUTH_TOKEN: string;
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_PROXIED_BASE_URL: string;
  ANTHROPIC_MODEL: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL: string;
  API_TIMEOUT_MS: string;
}

export { DEFAULT_CONFIG };

interface AgentProviderCustomKeyFormProps {
  config: ProviderConfig;
  loading: boolean;
  hasExistingKey: boolean;
  showDismissConfirm: boolean;
  error: string;
  onConfigChange: (key: keyof ProviderConfig, value: string) => void;
  onUseDefaults: () => void;
  onSubmit: () => void;
  onDismiss: () => void;
  onShowDismissConfirm: (show: boolean) => void;
  onBack: () => void;
}

export function AgentProviderCustomKeyForm({
  config,
  loading,
  hasExistingKey,
  showDismissConfirm,
  error,
  onConfigChange,
  onUseDefaults,
  onSubmit,
  onDismiss,
  onShowDismissConfirm,
  onBack,
}: AgentProviderCustomKeyFormProps) {
  const t = useTranslations('agentProvider');
  const tCommon = useTranslations('common');

  return (
    <div className="space-y-4 py-4">
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
            onChange={(e) => onConfigChange('ANTHROPIC_AUTH_TOKEN', e.target.value)}
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

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onUseDefaults}
        className="w-full"
        disabled={loading}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        {t('fillDefaultValues')}
      </Button>

      <div className="space-y-2">
        <Label htmlFor="base-url" className="text-sm font-medium">
          {t('baseUrl')}
        </Label>
        <Input
          id="base-url"
          type="text"
          value={config.ANTHROPIC_BASE_URL}
          onChange={(e) => onConfigChange('ANTHROPIC_BASE_URL', e.target.value)}
          placeholder={DEFAULT_CONFIG.ANTHROPIC_BASE_URL}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="model" className="text-sm font-medium">
          {t('defaultModel')}
        </Label>
        <Input
          id="model"
          type="text"
          value={config.ANTHROPIC_MODEL}
          onChange={(e) => onConfigChange('ANTHROPIC_MODEL', e.target.value)}
          placeholder={DEFAULT_CONFIG.ANTHROPIC_MODEL}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="haiku-model" className="text-xs font-medium">
            {t('haikuModel')}
          </Label>
          <Input
            id="haiku-model"
            type="text"
            value={config.ANTHROPIC_DEFAULT_HAIKU_MODEL}
            onChange={(e) => onConfigChange('ANTHROPIC_DEFAULT_HAIKU_MODEL', e.target.value)}
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
            onChange={(e) => onConfigChange('ANTHROPIC_DEFAULT_SONNET_MODEL', e.target.value)}
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
            onChange={(e) => onConfigChange('ANTHROPIC_DEFAULT_OPUS_MODEL', e.target.value)}
            placeholder={DEFAULT_CONFIG.ANTHROPIC_DEFAULT_OPUS_MODEL}
            disabled={loading}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timeout" className="text-sm font-medium">
          {t('apiTimeout')}
        </Label>
        <Input
          id="timeout"
          type="number"
          value={config.API_TIMEOUT_MS}
          onChange={(e) => onConfigChange('API_TIMEOUT_MS', e.target.value)}
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
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          {tCommon('back')}
        </Button>
        {hasExistingKey && !showDismissConfirm && (
          <Button
            variant="destructive"
            onClick={() => onShowDismissConfirm(true)}
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
              onClick={() => onShowDismissConfirm(false)}
              disabled={loading}
            >
              {tCommon('no')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDismiss}
              disabled={loading}
            >
              {t('yesDismiss')}
            </Button>
          </div>
        )}
        {!showDismissConfirm && (
          <Button
            onClick={onSubmit}
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
  );
}
