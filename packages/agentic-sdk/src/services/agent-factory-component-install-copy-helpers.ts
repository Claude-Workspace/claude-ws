/**
 * File copy and install helpers for agent factory component installation.
 * Handles copying directories, single files, and agent-set subdirectory trees
 * into a project's .claude directory.
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { mkdirSync, copyFileSync, rmSync } from 'fs';
import path from 'path';

/** Recursively copy all non-hidden files from src to dest */
export function copyDirectory(src: string, dest: string): void {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/** Copy a single file into targetDir, replacing any existing file */
export function installSingleFile(sourcePath: string, targetDir: string, fileName: string): void {
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, fileName);
  if (existsSync(targetPath)) rmSync(targetPath, { force: true });
  copyFileSync(sourcePath, targetPath);
}

/** Install all skills/commands/agents from an agent-set directory into claudeDir */
export function installAgentSet(
  agentSetPath: string,
  claudeDir: string
): { installed: string[]; errors: string[] } {
  const installed: string[] = [];
  const errors: string[] = [];

  for (const subdir of ['skills', 'commands', 'agents']) {
    const sourceSubdir = path.join(agentSetPath, subdir);
    if (!existsSync(sourceSubdir)) continue;
    for (const entry of readdirSync(sourceSubdir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const sourcePath = path.join(sourceSubdir, entry.name);
      const targetDir = path.join(claudeDir, subdir);
      try {
        if (entry.isDirectory()) {
          const targetSubDir = path.join(targetDir, entry.name);
          if (existsSync(targetSubDir)) rmSync(targetSubDir, { recursive: true, force: true });
          copyDirectory(sourcePath, targetSubDir);
        } else {
          installSingleFile(sourcePath, targetDir, entry.name);
        }
        installed.push(`${subdir}/${entry.name}`);
      } catch (err) {
        errors.push(`${subdir}/${entry.name}: ${(err as Error).message}`);
      }
    }
  }

  return { installed, errors };
}

/** Check if a skill directory is installed in claudeDir by examining subdirectory entries */
export function isAgentSetInstalled(agentSetPath: string, claudeDir: string): boolean {
  if (!existsSync(agentSetPath)) return false;
  for (const subdir of ['skills', 'commands', 'agents']) {
    const sourceSubdir = path.join(agentSetPath, subdir);
    if (!existsSync(sourceSubdir)) continue;
    const entries = readdirSync(sourceSubdir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (existsSync(path.join(claudeDir, subdir, entry.name))) return true;
    }
  }
  return false;
}

/** Uninstall all entries belonging to an agent-set from claudeDir */
export function uninstallAgentSet(agentSetPath: string, claudeDir: string): void {
  if (!existsSync(agentSetPath)) return;
  for (const subdir of ['skills', 'commands', 'agents']) {
    const sourceSubdir = path.join(agentSetPath, subdir);
    if (!existsSync(sourceSubdir)) continue;
    const entries = readdirSync(sourceSubdir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const targetPath = path.join(claudeDir, subdir, entry.name);
      if (!existsSync(targetPath)) continue;
      if (entry.isDirectory()) {
        rmSync(targetPath, { recursive: true, force: true });
      } else {
        rmSync(targetPath, { force: true });
      }
    }
  }
}
