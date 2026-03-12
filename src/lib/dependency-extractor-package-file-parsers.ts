// Parsers for package manager manifest files: package.json, requirements.txt, go.mod, Cargo.toml
// Used by DependencyExtractor to enrich library dependency data from lock/manifest files

import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { LibraryDep } from './dependency-extractor';

/**
 * Parse package.json dependencies and devDependencies into the library map
 */
export async function parsePackageJson(
  sourcePath: string,
  libraries: Map<string, LibraryDep>
): Promise<void> {
  const pkgPath = join(sourcePath, 'package.json');
  if (!existsSync(pkgPath)) return;
  try {
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
      libraries.set(`npm:${name}`, { name, version: version as string, manager: 'npm' });
    }
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
      const key = `npm:${name}`;
      if (!libraries.has(key)) {
        libraries.set(key, { name, version: version as string, manager: 'npm' });
      }
    }
  } catch {
    // Invalid package.json — skip
  }
}

/**
 * Parse requirements.txt pip dependencies into the library map
 */
export async function parseRequirementsTxt(
  sourcePath: string,
  libraries: Map<string, LibraryDep>
): Promise<void> {
  const reqPath = join(sourcePath, 'requirements.txt');
  if (!existsSync(reqPath)) return;
  try {
    const content = await readFile(reqPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)([~>=<!]+)?(.+)?/);
      if (match) {
        libraries.set(`pip:${match[1]}`, {
          name: match[1],
          version: match[2] && match[3] ? `${match[2]}${match[3]}` : undefined,
          manager: 'pip',
        });
      }
    }
  } catch {
    // Invalid requirements.txt — skip
  }
}

/**
 * Parse go.mod require directives into the library map
 */
export async function parseGoMod(
  sourcePath: string,
  libraries: Map<string, LibraryDep>
): Promise<void> {
  const goModPath = join(sourcePath, 'go.mod');
  if (!existsSync(goModPath)) return;
  try {
    const content = await readFile(goModPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('require ')) continue;
      const match = trimmed.match(/require\s+(\S+)\s+(.+)?/);
      if (match) {
        libraries.set(`go:${match[1]}`, { name: match[1], version: match[2], manager: 'go' });
      }
    }
  } catch {
    // Invalid go.mod — skip
  }
}

/**
 * Parse Cargo.toml [dependencies] section into the library map
 */
export async function parseCargoToml(
  sourcePath: string,
  libraries: Map<string, LibraryDep>
): Promise<void> {
  const cargoPath = join(sourcePath, 'Cargo.toml');
  if (!existsSync(cargoPath)) return;
  try {
    const content = await readFile(cargoPath, 'utf-8');
    const depsMatch = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
    if (!depsMatch) return;
    for (const line of depsMatch[1].split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^(\w+)(\s*=\s*)?(.+)?/);
      if (match) {
        libraries.set(`cargo:${match[1]}`, { name: match[1], version: match[3], manager: 'cargo' });
      }
    }
  } catch {
    // Invalid Cargo.toml — skip
  }
}

/**
 * Run all package file parsers for a directory
 */
export async function analyzePackageFiles(
  sourcePath: string,
  libraries: Map<string, LibraryDep>
): Promise<void> {
  await Promise.all([
    parsePackageJson(sourcePath, libraries),
    parseRequirementsTxt(sourcePath, libraries),
    parseGoMod(sourcePath, libraries),
    parseCargoToml(sourcePath, libraries),
  ]);
}
