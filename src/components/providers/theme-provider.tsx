'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

// Theme configuration for the application
// - light/dark: default themes (system preference switches between these)
// - theme-vscode-light/dark: VS Code 2017 palettes
// - dracula-dark: Dracula Dark color scheme
const THEMES = ['light', 'dark', 'theme-vscode-light', 'theme-vscode-dark', 'dracula-dark'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      themes={THEMES}
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
