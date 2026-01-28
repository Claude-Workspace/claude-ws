'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTunnelStore } from '@/stores/tunnel-store';
import { Zap, Settings } from 'lucide-react';
import { useTheme } from 'next-themes';

export function WizardStepMethod() {
  const t = useTranslations('accessAnywhere');
  const { setWizardStep, setSelectedMethod } = useTunnelStore();
  const { resolvedTheme } = useTheme();

  const handleSelect = (method: 'ctunnel' | 'cloudflare') => {
    setSelectedMethod(method);
    setWizardStep(2);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">{t('step2Title')}</h2>
        <p className="text-sm text-muted-foreground">{t('step2Subtitle')}</p>
      </div>

      <div className="grid gap-4">
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => handleSelect('ctunnel')}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-6 w-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{t('ctunnelTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('ctunnelDescription')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => handleSelect('cloudflare')}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Settings className="h-6 w-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  {t('cloudflareTitle').split('with')[0]}with
                  <img
                    src={resolvedTheme === 'dark' ? '/cloudflare-logo-dark.svg' : '/cloudflare-logo.svg'}
                    alt="Cloudflare"
                    className="h-6 w-auto"
                  />
                </h3>
                <p className="text-sm text-muted-foreground">{t('cloudflareDescription')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-start pt-4">
        <Button variant="outline" onClick={() => setWizardStep(0)}>
          {t('back')}
        </Button>
      </div>
    </div>
  );
}
