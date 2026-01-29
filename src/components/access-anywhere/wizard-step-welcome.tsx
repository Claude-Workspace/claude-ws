'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useTunnelStore } from '@/stores/tunnel-store';

export function WizardStepWelcome() {
  const t = useTranslations('accessAnywhere');
  const { setWizardStep } = useTunnelStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-[90%]">
          <img
            src="/anywhere.svg"
            alt="Access from any device"
            className="h-full w-full transition-all"
            style={{
              filter: 'invert(48%) sepia(79%) saturate(383%) hue-rotate(334deg) brightness(96%) contrast(88%)',
            }}
          />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">{t('step1Title')}</h2>
          <p className="text-sm text-muted-foreground mt-2">{t('step1Description')}</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button onClick={() => setWizardStep(1)}>
          {t('getStarted')}
        </Button>
      </div>
    </div>
  );
}
