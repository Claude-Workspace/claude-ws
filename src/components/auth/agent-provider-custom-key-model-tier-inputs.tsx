'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { DEFAULT_CONFIG, type ProviderConfig } from '@/components/auth/agent-provider-custom-key-form';

interface AgentProviderCustomKeyModelTierInputsProps {
  config: ProviderConfig;
  loading: boolean;
  onConfigChange: (key: keyof ProviderConfig, value: string) => void;
}

/**
 * Three-column grid of haiku / sonnet / opus model name inputs
 * used inside AgentProviderCustomKeyForm.
 */
export function AgentProviderCustomKeyModelTierInputs({
  config,
  loading,
  onConfigChange,
}: AgentProviderCustomKeyModelTierInputsProps) {
  const t = useTranslations('agentProvider');

  return (
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
  );
}
