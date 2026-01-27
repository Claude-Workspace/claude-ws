// IMPORTANT: When adding new languages, keep this array sorted alphabetically by locale code
// Also update: localeNames, localeFlags, create translation file in /locales/{code}.json
// Update language-switcher.tsx to include new locale in the detection array
export const locales = ['de', 'en', 'es', 'fr', 'ja', 'ko', 'vi', 'zh'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

// IMPORTANT: Keep localeNames sorted alphabetically by locale code to match locales array above
export const localeNames: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ja: '日本語',
  ko: '한국어',
  vi: 'Tiếng Việt',
  zh: '中文',
};

// IMPORTANT: Keep localeFlags sorted alphabetically by locale code to match locales array above
export const localeFlags: Record<Locale, string> = {
  de: '🇩🇪',
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  ja: '🇯🇵',
  ko: '🇰🇷',
  vi: '🇻🇳',
  zh: '🇨🇳',
};
