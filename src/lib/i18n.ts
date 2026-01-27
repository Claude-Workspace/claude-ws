import { useTranslations } from 'next-intl';

/**
 * Hook to get translations for a specific namespace
 * @param namespace - The translation namespace (e.g., 'common', 'header', 'kanban')
 * @returns Translation function
 *
 * @example
 * ```tsx
 * const t = useI18n('common');
 * <button>{t('save')}</button>
 * ```
 */
export function useI18n(namespace: string) {
  return useTranslations(namespace);
}

/**
 * Hook to get common translations
 * @returns Common translations
 *
 * @example
 * ```tsx
 * const t = useCommonI18n();
 * <button>{t('save')}</button>
 * ```
 */
export function useCommonI18n() {
  return useTranslations('common');
}
