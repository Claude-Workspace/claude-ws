/**
 * Terminal Shell Detection - Cross-platform shell binary resolver
 *
 * Detects the appropriate interactive shell for the current platform:
 * - Windows: powershell.exe (preferred) or cmd.exe (fallback)
 * - macOS/Linux: $SHELL env var, or zsh (macOS) / bash (Linux) fallback
 */

import { existsSync } from 'fs';

export interface ShellConfig {
  file: string;
  args: string[];
  env: Record<string, string>;
}

export function detectShell(): ShellConfig {
  if (process.platform === 'win32') {
    return detectWindowsShell();
  }
  return detectUnixShell();
}

function detectWindowsShell(): ShellConfig {
  // Prefer PowerShell 7+ (pwsh)
  const pwshPaths = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
  ];

  for (const p of pwshPaths) {
    if (existsSync(p)) {
      return { file: p, args: ['-NoLogo'], env: {} };
    }
  }

  // Windows PowerShell (always available on modern Windows)
  return { file: 'powershell.exe', args: ['-NoLogo'], env: {} };
}

function detectUnixShell(): ShellConfig {
  const userShell = process.env.SHELL;

  // Use --login so .zprofile is sourced — needed for nvm, Homebrew PATH, etc.
  // Blank-screen issue on toggle is fixed by keeping xterm mounted (CSS hide).
  if (userShell && existsSync(userShell)) {
    return {
      file: userShell,
      args: ['--login'],
      env: { TERM: 'xterm-256color' },
    };
  }

  // Fallback: zsh on macOS, bash on Linux
  const fallback = process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
  return {
    file: fallback,
    args: ['--login'],
    env: { TERM: 'xterm-256color' },
  };
}
