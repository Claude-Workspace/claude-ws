'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useTunnelStore } from '@/stores/tunnel-store';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from 'next-themes';

export function WizardStepCloudflare() {
  const t = useTranslations('accessAnywhere');
  const { setWizardStep, setWizardOpen } = useTunnelStore();
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  const handleFinish = () => {
    // Mark onboarding as completed in localStorage so wizard won't auto-open again
    localStorage.setItem('onboarding_completed', 'true');
    const { completeOnboarding } = useTunnelStore.getState();
    completeOnboarding();
    setWizardOpen(false);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(key);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const CommandBlock = ({ command, label, key }: { command: string; label: string; key: string }) => (
    <div className="flex items-center gap-2 group">
      <code className="flex-1 bg-background px-2 py-1.5 rounded text-xs font-mono overflow-x-auto">
        {command}
      </code>
      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(command, key)}
      >
        {copiedCommand === key ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold flex items-center justify-center gap-2">
          {t('cloudflareHeaderWith')}
          <img
            src={resolvedTheme === 'dark' ? '/cloudflare-logo-dark.svg' : '/cloudflare-logo.svg'}
            alt="Cloudflare"
            className="h-9 w-auto"
          />
        </h2>
        <p className="text-sm text-muted-foreground">{t('cloudflareDescription')}</p>
      </div>

      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          <p className="font-medium text-sm">{t('cloudflareGuide')}</p>

          <div className="space-y-3 text-xs">
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">1. {t('installCloudflared')}</h4>
              <CommandBlock
                key="install-macos"
                command="brew install cloudflared"
                label="macOS"
              />
              <CommandBlock
                key="install-linux"
                command="curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared"
                label="Linux (download)"
              />
              <CommandBlock
                key="install-linux2"
                command="chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/"
                label="Linux (install)"
              />
              <CommandBlock
                key="install-windows"
                command="winget install Cloudflare.cloudflared"
                label="Windows"
              />
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">2. {t('authenticateWithCloudflare')}</h4>
              <CommandBlock
                key="auth"
                command="cloudflared tunnel login"
                label="Authenticate"
              />
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">3. {t('createTunnel')}</h4>
              <CommandBlock
                key="create"
                command="cloudflared tunnel create claude-workspace"
                label="Create tunnel"
              />
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">4. {t('configureTunnel')}</h4>
              <p className="text-muted-foreground">
                Create <code className="bg-background px-1.5 py-0.5 rounded">~/.cloudflared/config.yml</code>:
              </p>
              <div className="bg-background p-3 rounded text-xs font-mono space-y-1">
                <div>tunnel: claude-workspace</div>
                <div>credentials-file: ~/.cloudflared/&lt;TUNNEL_ID&gt;.json</div>
                <div className="pt-2">ingress:</div>
                <div className="pl-4">- hostname: claude-ws.yourdomain.com</div>
                <div className="pl-6">service: http://localhost:8556</div>
                <div className="pl-4">- service: http_status:404</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">5. {t('addDnsRecord')}</h4>
              <CommandBlock
                key="dns"
                command="cloudflared tunnel route dns claude-workspace claude-ws.yourdomain.com"
                label="Add DNS"
              />
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">6. {t('runTunnel')}</h4>
              <CommandBlock
                key="run"
                command="cloudflared tunnel run claude-workspace"
                label="Run tunnel"
              />
              <p className="text-muted-foreground pt-1">
                {t('orInstallAsService')}
              </p>
              <CommandBlock
                key="service-install"
                command="sudo cloudflared service install"
                label="Install service"
              />
              <CommandBlock
                key="service-start"
                command="sudo systemctl start cloudflared"
                label="Start service"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setWizardStep(1)}>
          {t('back')}
        </Button>
        <Button onClick={handleFinish}>
          {t('finish')}
        </Button>
      </div>
    </div>
  );
}
