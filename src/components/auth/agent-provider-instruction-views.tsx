'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackAndReloadFooterProps {
  onBack: () => void;
  onReload: () => void;
  reloadLabel: string;
}

function BackAndReloadFooter({ onBack, onReload, reloadLabel }: BackAndReloadFooterProps) {
  const tCommon = useTranslations('common');
  return (
    <div className="flex gap-2">
      <Button variant="ghost" onClick={onBack} className="flex-1">
        {tCommon('back')}
      </Button>
      <Button onClick={onReload} className="flex-1">
        {reloadLabel}
      </Button>
    </div>
  );
}

interface OAuthInstructionViewProps {
  error: string;
  onBack: () => void;
  onReload: () => void;
}

export function OAuthInstructionView({ error, onBack, onReload }: OAuthInstructionViewProps) {
  const t = useTranslations('agentProvider');
  return (
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
      <BackAndReloadFooter onBack={onBack} onReload={onReload} reloadLabel={t('loggedInReload')} />
    </div>
  );
}

interface ConsoleInstructionViewProps {
  onBack: () => void;
  onReload: () => void;
}

export function ConsoleInstructionView({ onBack, onReload }: ConsoleInstructionViewProps) {
  const t = useTranslations('agentProvider');
  return (
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
      <BackAndReloadFooter onBack={onBack} onReload={onReload} reloadLabel={t('loggedInReload')} />
    </div>
  );
}

interface SettingsInstructionViewProps {
  settingsConfigured: boolean;
  onBack: () => void;
  onReload: () => void;
}

export function SettingsInstructionView({ settingsConfigured, onBack, onReload }: SettingsInstructionViewProps) {
  const t = useTranslations('agentProvider');
  return (
    <div className="space-y-4 py-4">
      <div className="p-4 rounded-lg bg-muted/50">
        <h4 className="font-medium mb-2">{t('usingClaudeCodeSettings')}</h4>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>{t('settingsFileDescription')}</p>
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
          {settingsConfigured ? (
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
      <BackAndReloadFooter onBack={onBack} onReload={onReload} reloadLabel={t('reloadToApply')} />
    </div>
  );
}
