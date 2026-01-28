import { getRequestConfig } from 'next-intl/server';
import { locales, type Locale } from './config';

// Static imports with relative paths for Turbopack compatibility
// (tsconfig path aliases like @/locales/* don't resolve in global npm installs)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messageImports: Record<Locale, () => Promise<{ default: Record<string, any> }>> = {
  de: () => import('../../locales/de.json'),
  en: () => import('../../locales/en.json'),
  es: () => import('../../locales/es.json'),
  fr: () => import('../../locales/fr.json'),
  ja: () => import('../../locales/ja.json'),
  ko: () => import('../../locales/ko.json'),
  vi: () => import('../../locales/vi.json'),
  zh: () => import('../../locales/zh.json'),
};

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as any)) {
    locale = 'en';
  }

  return {
    locale,
    messages: (await messageImports[locale as Locale]()).default,
  };
});
