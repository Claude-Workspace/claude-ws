# Adding a New Language

## Steps to add a new language locale:

1. **Update `src/i18n/config.ts`**
   - Add locale code to `locales` array (sorted alphabetically)
   - Add native name to `localeNames` object (sorted alphabetically)
   - Add flag emoji to `localeFlags` object (sorted alphabetically)

2. **Update `src/components/ui/language-switcher.tsx`**
   - Add the new locale code to the detection array (sorted alphabetically)

3. **Create translation file**
   - Create `/locales/{code}.json` with complete translations
   - Reference `en.json` for the structure

## Important Rules:

- **ALWAYS keep locale arrays sorted alphabetically by locale code**
- This makes it easy to see if a locale is missing
- Prevents duplicate entries
- Makes maintenance easier

## Current Locales (Alphabetical Order):

| Code | Language    | Flag  |
|------|-------------|-------|
| de   | Deutsch     | 🇩🇪    |
| en   | English     | 🇺🇸    |
| es   | Español     | 🇪🇸    |
| fr   | Français    | 🇫🇷    |
| ja   | 日本語       | 🇯🇵    |
| ko   | 한국어       | 🇰🇷    |
| vi   | Tiếng Việt  | 🇻🇳    |
| zh   | 中文         | 🇨🇳    |

## Example: Adding Italian (it)

```typescript
// src/i18n/config.ts
export const locales = ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'vi', 'zh'] as const;

export const localeNames: Record<Locale, string> = {
  // ... existing locales ...
  it: 'Italiano',
  // ... rest of locales ...
};

export const localeFlags: Record<Locale, string> = {
  // ... existing locales ...
  it: '🇮🇹',
  // ... rest of locales ...
};
```

```typescript
// src/components/ui/language-switcher.tsx
if (segments.length > 0 && ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'vi', 'zh'].includes(segments[0])) {
```

```json
// locales/it.json
{
  "common": {
    "loading": "Caricamento",
    // ... rest of translations
  }
}
```
