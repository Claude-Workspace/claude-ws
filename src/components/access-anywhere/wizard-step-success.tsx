'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTunnelStore } from '@/stores/tunnel-store';
import { CheckCircle2, Copy } from 'lucide-react';

export function WizardStepSuccess() {
  const t = useTranslations('accessAnywhere');
  const { url, setWizardOpen } = useTunnelStore();
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = () => {
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFinish = () => {
    const { completeOnboarding } = useTunnelStore.getState();
    completeOnboarding();
    setWizardOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">{t('successTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-2">{t('successDescription')}</p>
        </div>
      </div>

      {url && (
        <div className="space-y-2">
          <Label htmlFor="success-url">{t('yourPublicUrl')}</Label>
          <div className="flex gap-2">
            <Input
              id="success-url"
              value={url}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyUrl}
              title={t('copyUrl')}
            >
              {copied ? '✓' : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {copied && (
            <p className="text-xs text-green-600">{t('urlCopied')}</p>
          )}
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-4 text-sm">
        <p className="text-muted-foreground">
          {t('successHint')}
        </p>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleFinish}>
          {t('finish')}
        </Button>
      </div>
    </div>
  );
}
