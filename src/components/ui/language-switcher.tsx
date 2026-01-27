'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { localeNames, localeFlags, type Locale, defaultLocale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: Locale) => {
    // Get the path without locale prefix
    const segments = pathname.split('/').filter(Boolean);

    // IMPORTANT: Keep this array sorted alphabetically to match locales in src/i18n/config.ts
    // When adding new locales, add them in alphabetical order
    if (segments.length > 0 && ['de', 'en', 'es', 'fr', 'ja', 'ko', 'vi', 'zh'].includes(segments[0])) {
      segments.shift();
    }

    // Build the remaining path
    const remainingPath = segments.join('/');

    // Construct new pathname based on target locale
    const newPathname = newLocale === defaultLocale
      ? `/${remainingPath || ''}` // For English, no prefix
      : `/${newLocale}${remainingPath ? `/${remainingPath}` : ''}`; // For others, add prefix

    // Set cookie to force locale change
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=lax`;

    // Use Next.js router for client-side navigation (no reload)
    router.push(newPathname);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <Languages className="h-4 w-4" />
          <span className="emoji-flag text-lg" style={{ fontSize: '1.25rem' }}>{localeFlags[locale]}</span>
          <span>{localeNames[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {(Object.keys(localeNames) as Locale[]).map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={locale === loc ? 'bg-accent' : ''}
          >
            <span className="mr-2 emoji-flag text-lg" style={{ fontSize: '1.25rem' }}>{localeFlags[loc]}</span>
            <span>{localeNames[loc]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
