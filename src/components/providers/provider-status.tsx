/**
 * Provider Status Component - Availability indicator badge
 */

'use client';

import { useTranslations } from 'next-intl';

interface ProviderStatusProps {
  available: boolean;
  reason?: string;
}

export function ProviderStatus({ available, reason }: ProviderStatusProps) {
  const t = useTranslations('providers');

  if (available) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
        <span className="w-2 h-2 mr-1 rounded-full bg-green-500" />
        {t('available')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
      <span className="w-2 h-2 mr-1 rounded-full bg-red-500" />
      {reason || t('unavailable')}
    </span>
  );
}

export default ProviderStatus;
