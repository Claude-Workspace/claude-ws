import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Locale, defaultLocale } from '@/i18n/config';

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: defaultLocale,
      setLocale: (locale: Locale) => {
        set({ locale });
        // Update URL without full page reload
        const url = new URL(window.location.href);
        const pathSegments = url.pathname.split('/').filter(Boolean);

        // Remove existing locale if present
        if (pathSegments[0] && ['en', 'ja', 'es'].includes(pathSegments[0])) {
          pathSegments.shift();
        }

        // Add new locale prefix if not default
        const newPath = locale === defaultLocale
          ? `/${pathSegments.join('/') || ''}`
          : `/${locale}/${pathSegments.join('/')}`;

        window.history.pushState(null, '', newPath);
        window.location.reload();
      },
    }),
    {
      name: 'locale-storage',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
