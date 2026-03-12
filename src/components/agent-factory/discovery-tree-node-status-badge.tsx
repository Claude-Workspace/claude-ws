'use client';

/**
 * Small colored badge showing a discovered plugin's import status: new, update, or current.
 * Used inside discovery tree nodes.
 */

import { useTranslations } from 'next-intl';

interface DiscoveryTreeNodeStatusBadgeProps {
  status: string;
}

export function DiscoveryTreeNodeStatusBadge({ status }: DiscoveryTreeNodeStatusBadgeProps) {
  const t = useTranslations('agentFactory');
  switch (status) {
    case 'new':
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {t('newStatus')}
        </span>
      );
    case 'update':
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          {t('update')}
        </span>
      );
    case 'current':
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
          {t('current')}
        </span>
      );
    default:
      return null;
  }
}
