/**
 * Check for available updates on npm registry
 * Shows notification if newer version available
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function checkForUpdates() {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const currentVersion = pkg.version;

    // Quick check - don't block startup
    const latestVersion = execSync('npm show claude-ws version', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress errors
    }).trim();

    if (latestVersion && latestVersion !== currentVersion) {
      console.log('');
      console.log('\x1b[33m%s\x1b[0m', '┌─────────────────────────────────────────────┐');
      console.log('\x1b[33m%s\x1b[0m', '│  Update available!                          │');
      console.log('\x1b[33m%s\x1b[0m', `│  ${currentVersion} → ${latestVersion}                         │`);
      console.log('\x1b[33m%s\x1b[0m', '│  Run: npm update -g claude-ws               │');
      console.log('\x1b[33m%s\x1b[0m', '└─────────────────────────────────────────────┘');
      console.log('');
    }
  } catch (error) {
    // Silently fail - don't block startup for update check
  }
}
